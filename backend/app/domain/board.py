from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any, Literal

from pydantic import BaseModel

from app.domain.capacity import team_capacity
from app.domain.errors import FieldError
from app.domain.plan import Backlog, ReplanChange, SprintPlanning, Story, WipLimit
from app.domain.project import Member, Project, normalize_name

TaskStatus = Literal["backlog", "todo", "in_progress", "review", "done"]
TaskType = Literal["feature", "bug", "chore", "spike"]
Priority = Literal["low", "medium", "high"]


class Sprint(BaseModel):
    id: int | None = None
    project_id: int
    number: int
    name: str
    goal: str
    phase: str = ""
    # Spec 008: a closed sprint takes no more tasks; end_date is when it's due (None on a continuous board).
    closed: bool = False
    end_date: date | None = None


class ChecklistItem(BaseModel):
    text: str
    done: bool = False


class Task(BaseModel):
    id: int | None = None
    project_id: int
    sprint_id: int | None = None
    assignee_id: int | None = None
    key: str
    epic_key: str = ""
    title: str
    description: str = ""
    acceptance_criteria: list[str] = []
    checklist: list[ChecklistItem] = []
    type: TaskType = "feature"
    points: int = 1
    priority: Priority = "medium"
    status: TaskStatus = "backlog"
    position: int = 0
    # Set when no member covers the story's role; cleared when someone is assigned (spec 003, FR-006).
    missing_role: str | None = None


class Objective(BaseModel):
    """A sprint's goal together with its tasks; met when all of them are done (spec 008 closes it)."""

    id: int | None = None
    project_id: int
    sprint_id: int
    title: str
    done: bool = False


# ---------- Building the board from the approved plan (spec 003, US1) ----------


@dataclass
class BuiltSprint:
    """A sprint to create, its objective (the sprint's goal) and its tasks. Ids don't exist
    yet: ApplyPlan sets `sprint_id` on the objective and the tasks once the sprint is saved."""

    sprint: Sprint
    tasks: list[Task] = field(default_factory=list)

    @property
    def objective_title(self) -> str:
        return self.sprint.goal


@dataclass
class BuiltBoard:
    sprints: list[BuiltSprint] = field(default_factory=list)
    backlog: list[Task] = field(default_factory=list)  # stories the plan didn't place in any sprint
    skipped: list[str] = field(default_factory=list)  # story keys the plan names but the backlog lacks

    @property
    def tasks(self) -> list[Task]:
        return [t for s in self.sprints for t in s.tasks] + self.backlog


def checklist_from_criteria(criteria: Iterable[str]) -> list[ChecklistItem]:
    """One unchecked item per acceptance criterion (FR-005)."""
    return [ChecklistItem(text=c.strip()) for c in criteria if c.strip()]


def _same_name(a: str, b: str) -> bool:
    return normalize_name(a).casefold() == normalize_name(b).casefold()


def assign(story: Story, named: str | None, members: Sequence[Member], points: dict[int, int]) -> tuple[int | None, str | None]:
    """(assignee_id, missing_role) for a story (FR-006): the member the agent named if exactly
    one has that name; else the member with the story's role and the fewest `points` in the
    sprint (team order breaks ties); else nobody, flagged with the missing role."""
    if named:
        matches = [m for m in members if _same_name(m.name, named)]
        if len(matches) == 1 and matches[0].id is not None:
            return matches[0].id, None
    by_role = [m for m in members if m.id is not None and story.role and _same_name(m.role, story.role)]
    if by_role:
        chosen = min(by_role, key=lambda m: points.get(m.id, 0))  # type: ignore[arg-type]
        return chosen.id, None
    return None, story.role or None


def task_from_story(project_id: int, story: Story, status: TaskStatus, position: int) -> Task:
    return Task(
        project_id=project_id,
        key=story.key,
        epic_key=story.epic_key,
        title=story.title,
        description=story.description,
        acceptance_criteria=list(story.acceptance_criteria),
        checklist=checklist_from_criteria(story.acceptance_criteria),
        type=story.type,
        points=story.points,
        priority=story.priority,
        status=status,
        position=position,
    )


def build_board(project_id: int, members: Sequence[Member], backlog: Backlog, sprint_planning: SprintPlanning) -> BuiltBoard:
    """Pure: one sprint per iteration with its stories in "todo", the unplaced stories in
    "backlog", each story exactly once. Unknown story keys are skipped and reported."""
    stories = {}
    for story in backlog.stories:
        stories.setdefault(story.key, story)
    named = {a.story_key: a.member_name for a in sprint_planning.assignments}
    placed: set[str] = set()
    board = BuiltBoard()

    def build(story: Story, status: TaskStatus, position: int, points: dict[int, int]) -> Task:
        task = task_from_story(project_id, story, status, position)
        task.assignee_id, task.missing_role = assign(story, named.get(story.key), members, points)
        if task.assignee_id is not None:
            points[task.assignee_id] = points.get(task.assignee_id, 0) + story.points
        return task

    for plan in sorted(sprint_planning.sprints, key=lambda s: s.number):
        built = BuiltSprint(Sprint(project_id=project_id, number=plan.number, name=plan.name, goal=plan.goal, phase=plan.phase))
        points: dict[int, int] = {}
        for key in plan.story_keys:
            if key not in stories:
                if key not in board.skipped:
                    board.skipped.append(key)
                continue
            if key in placed:  # a story in two iterations stays in the first one
                continue
            placed.add(key)
            built.tasks.append(build(stories[key], "todo", len(built.tasks), points))
        board.sprints.append(built)

    backlog_points: dict[int, int] = {}
    for story in stories.values():
        if story.key not in placed:
            board.backlog.append(build(story, "backlog", len(board.backlog), backlog_points))
    return board


# ---------- Read model rules (spec 003, US2 and US4) ----------

DEFAULT_SPRINT_WEEKS = 2


class SprintLoad(BaseModel):
    points: int
    capacity: int
    overloaded: bool


def methodology(project: Project) -> str:
    """The approved methodology, or the requested one while the plan doesn't have it."""
    approved = (project.plan or {}).get("methodology") or {}
    return approved.get("methodology") or project.requested_methodology


def is_continuous(project: Project) -> bool:
    """Kanban has no iterations: one board, no sprint selector and no sprint capacity."""
    return methodology(project) == "kanban"


def wip_limits(project: Project) -> list[WipLimit]:
    approved = (project.plan or {}).get("methodology") or {}
    return [WipLimit.model_validate(limit) for limit in approved.get("wip_limits", [])]


def sprint_weeks(project: Project) -> int:
    approved = (project.plan or {}).get("methodology") or {}
    return approved.get("sprint_length_weeks") or DEFAULT_SPRINT_WEEKS


def sprint_end_date(start: date, number: int, weeks: int) -> date:
    """Iterations run back to back from `start` (the day the plan is applied): sprint 1 ends
    `weeks` weeks later, sprint 2 `weeks` after that, and so on (spec 008, T002)."""
    return start + timedelta(weeks=weeks * number)


def sprint_capacity(project: Project) -> int:
    """The leader's fixed points per sprint, or the estimate from hours and seniority (FR-017)."""
    if project.sprint_capacity_override is not None:
        return project.sprint_capacity_override
    return team_capacity(project.members, sprint_weeks(project))


def sprint_load(sprint_id: int | None, tasks: Iterable[Task], capacity: int) -> SprintLoad:
    points = sum(t.points for t in tasks if t.sprint_id == sprint_id)
    return SprintLoad(points=points, capacity=capacity, overloaded=points > capacity)


# ---------- Working on the board (spec 003, US2–US4) ----------

# Limits from the API Contract in plan.md.
TITLE_MAX = 200
POINTS_RANGE = (0, 100)
CHECKLIST_TEXT_MAX = 300
CHECKLIST_MAX_ITEMS = 50
CAPACITY_RANGE = (1, 500)
NULLABLE_TASK_FIELDS = frozenset({"sprint_id", "assignee_id"})


class WipWarning(BaseModel):
    code: Literal["wip_limit_exceeded"] = "wip_limit_exceeded"
    column: TaskStatus
    limit: int
    count: int


class OverloadWarning(BaseModel):
    code: Literal["sprint_overloaded"] = "sprint_overloaded"
    sprint_id: int
    points: int
    capacity: int


# Warnings never block (constitution, principle 4): they're returned next to the saved task.
BoardWarning = WipWarning | OverloadWarning


def wip_warnings(tasks: Iterable[Task], limits: Iterable[WipLimit]) -> list[WipWarning]:
    """One warning per column with more cards than its limit. `tasks` is one board: a sprint,
    or the whole project on a continuous board."""
    counts: dict[str, int] = {}
    for task in tasks:
        counts[task.status] = counts.get(task.status, 0) + 1
    return [
        WipWarning(column=limit.column, limit=limit.limit, count=counts[limit.column])
        for limit in limits
        if counts.get(limit.column, 0) > limit.limit
    ]


def reorder(
    tasks: Sequence[Task],
    task_id: int,
    status: TaskStatus,
    position: int | None,
    sprint_id: int | None,
    *,
    continuous: bool = False,
) -> list[Task]:
    """Moves a task to `position` (the end when None) of the `status` column of `sprint_id`
    and compacts the positions of the source and target columns. A column is a status within
    one sprint, or across the whole project on a continuous board.
    Returns copies of the tasks that changed."""

    def column(task: Task) -> tuple[int | None, str]:
        return (None if continuous else task.sprint_id, task.status)

    originals = {t.id: t for t in tasks}
    moving = originals[task_id]
    moved = moving.model_copy(update={"status": status, "sprint_id": sprint_id})
    source, target = column(moving), column(moved)

    def ordered(key: tuple[int | None, str]) -> list[Task]:
        rest = (t for t in tasks if t.id != task_id and column(t) == key)
        return sorted(rest, key=lambda t: (t.position, t.id or 0))

    target_tasks = ordered(target)
    target_tasks.insert(len(target_tasks) if position is None else min(position, len(target_tasks)), moved)
    columns = [target_tasks] if source == target else [target_tasks, ordered(source)]
    updated = [t.model_copy(update={"position": i}) for col in columns for i, t in enumerate(col)]
    return [t for t in updated if t != originals[t.id]]


def task_change_errors(values: dict[str, Any], sprint_ids: set[int], member_ids: set[int]) -> list[FieldError]:
    """Every rule a PATCH /tasks/{id} breaks; `values` only carries the fields the client sent.
    Enum values are checked by the request schema."""
    if not values:
        return [FieldError("", "No fields to update.")]
    errors: list[FieldError] = []
    for name, value in values.items():
        if value is None and name not in NULLABLE_TASK_FIELDS:
            errors.append(FieldError(name, "Required."))
    if values.get("position") is not None and values["position"] < 0:
        errors.append(FieldError("position", "Must be 0 or more."))
    if values.get("points") is not None:
        low, high = POINTS_RANGE
        if not low <= values["points"] <= high:
            errors.append(FieldError("points", f"Must be between {low} and {high}."))
    if values.get("title") is not None:
        title = values["title"].strip()
        if not title:
            errors.append(FieldError("title", "Required."))
        elif len(title) > TITLE_MAX:
            errors.append(FieldError("title", f"Max {TITLE_MAX} characters."))
    if values.get("sprint_id") is not None and values["sprint_id"] not in sprint_ids:
        errors.append(FieldError("sprint_id", "Unknown sprint in this project."))
    if values.get("assignee_id") is not None and values["assignee_id"] not in member_ids:
        errors.append(FieldError("assignee_id", "Unknown member in this project."))
    return errors


def edit_task(task: Task, values: dict[str, Any]) -> Task:
    """Applies already validated edit fields; assigning someone clears the missing role."""
    update = dict(values)
    if "title" in update:
        update["title"] = update["title"].strip()
    if update.get("assignee_id") is not None:
        update["missing_role"] = None
    return task.model_copy(update=update)


def checklist_errors(items: Sequence[ChecklistItem]) -> list[FieldError]:
    errors: list[FieldError] = []
    if len(items) > CHECKLIST_MAX_ITEMS:
        errors.append(FieldError("items", f"Max {CHECKLIST_MAX_ITEMS} items."))
    for i, item in enumerate(items):
        text = item.text.strip()
        if not text:
            errors.append(FieldError(f"items[{i}].text", "Required."))
        elif len(text) > CHECKLIST_TEXT_MAX:
            errors.append(FieldError(f"items[{i}].text", f"Max {CHECKLIST_TEXT_MAX} characters."))
    return errors


def suggest_advance(task: Task) -> bool:
    """Every checklist item done while the task is in progress: offer "move to In review?",
    never move it by itself (FR-015)."""
    return task.status == "in_progress" and bool(task.checklist) and all(i.done for i in task.checklist)


# ---------- Sprints, objectives and replans (spec 008) ----------


def pending_tasks(sprint_id: int | None, tasks: Iterable[Task]) -> list[Task]:
    """The sprint's tasks that aren't done, in board order."""
    return sorted((t for t in tasks if t.sprint_id == sprint_id and t.status != "done"), key=lambda t: (t.position, t.id or 0))


def velocity(sprints: Iterable[Sprint], tasks: Sequence[Task]) -> list[int]:
    """Done points of each closed sprint, in sprint order: the team's real pace."""
    return [
        sum(t.points for t in tasks if t.sprint_id == s.id and t.status == "done")
        for s in sorted(sprints, key=lambda s: s.number)
        if s.closed
    ]


def objectives_to_close(objectives: Iterable[Objective], tasks: Sequence[Task]) -> list[Objective]:
    """The objectives whose `done` changes: met when every task of its sprint is done (FR-007),
    in progress again when one of them leaves "done". A sprint without tasks has nothing to meet."""
    changed = []
    for objective in objectives:
        sprint_tasks = [t for t in tasks if t.sprint_id == objective.sprint_id]
        met = bool(sprint_tasks) and all(t.status == "done" for t in sprint_tasks)
        if met != objective.done:
            changed.append(objective.model_copy(update={"done": met}))
    return changed


STALE_CHANGE = "task changed since the proposal"


def find_member(members: Sequence[Member], name: str | None) -> Member | None:
    """The only member with that name (spaces and case ignored), or None."""
    if not name:
        return None
    matches = [m for m in members if _same_name(m.name, name)]
    return matches[0] if len(matches) == 1 else None


def replan_change_problem(
    change: ReplanChange, tasks: dict[str, Task], open_sprints: dict[int, Sprint], members: Sequence[Member]
) -> str | None:
    """Why an approved replan change can't be applied to the board as it is now (it's then
    discarded and reported, FR-012), or None. `tasks` is the board when applying started,
    by key; `open_sprints` by number. Done tasks never change (FR-011)."""
    if change.kind == "add":
        if change.new_story is None:
            return "no story to add"
        if change.new_story.key in tasks:
            return f"a task with key {change.new_story.key} already exists"
    else:
        task = tasks.get(change.task_key or "")
        if task is None:
            return "task no longer on the board"
        if task.status == "done" or (change.expected_status is not None and task.status != change.expected_status):
            return STALE_CHANGE
        if change.kind == "reassign" and find_member(members, change.to_member) is None:
            return f"{change.to_member or 'the member'} isn't on the team"
    if change.kind in ("move", "add") and change.to_sprint is not None and change.to_sprint not in open_sprints:
        return f"sprint {change.to_sprint} doesn't exist or is closed"
    return None


def replan_status(task: Task, sprint_id: int | None) -> TaskStatus:
    """A replan move keeps the work's progress: to the backlog it's "backlog", from the backlog
    into a sprint it's "todo", otherwise the status stays (unlike a manual move, spec 003)."""
    if sprint_id is None:
        return "backlog"
    return "todo" if task.status == "backlog" else task.status
