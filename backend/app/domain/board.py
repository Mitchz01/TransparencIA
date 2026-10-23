from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field
from typing import Literal

from pydantic import BaseModel

from app.domain.capacity import team_capacity
from app.domain.plan import Backlog, SprintPlanning, Story, WipLimit
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


def _task(project_id: int, story: Story, status: TaskStatus, position: int) -> Task:
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
        task = _task(project_id, story, status, position)
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


def sprint_capacity(project: Project) -> int:
    """The leader's fixed points per sprint, or the estimate from hours and seniority (FR-017)."""
    if project.sprint_capacity_override is not None:
        return project.sprint_capacity_override
    return team_capacity(project.members, sprint_weeks(project))


def sprint_load(sprint_id: int | None, tasks: Iterable[Task], capacity: int) -> SprintLoad:
    points = sum(t.points for t in tasks if t.sprint_id == sprint_id)
    return SprintLoad(points=points, capacity=capacity, overloaded=points > capacity)
