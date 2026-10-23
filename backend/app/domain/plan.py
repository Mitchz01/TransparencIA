"""Project plan: the planning stages and the output schema of each one.
The agents use them as output_schema, so the result arrives as validated
JSON and can be persisted directly."""

from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from app.domain.diagrams import check_mermaid
from app.domain.errors import StageNotFound

Level = Literal["low", "medium", "high"]

# Every stage output says why: it's the rationale the leader sees on the proposal (spec 002, FR-004).
RATIONALE = "Why you decided this, in 2-3 sentences"


# ---------- Product analyst ----------


class Risk(BaseModel):
    description: str
    impact: Level
    mitigation: str


class Analysis(BaseModel):
    summary: str = Field(description="Project summary in 2-3 sentences")
    goals: list[str]
    in_scope: list[str]
    out_of_scope: list[str]
    risks: list[Risk]
    complexity: Level
    team_gaps: list[str] = Field(description="Roles or skills the team is missing")
    rationale: str = Field(description=RATIONALE)


# ---------- Agile coach ----------


class Ceremony(BaseModel):
    name: str
    frequency: str
    purpose: str


class WipLimit(BaseModel):
    column: Literal["todo", "in_progress", "review"]
    limit: int


class Alternative(BaseModel):
    methodology: str
    why_not: str


class MethodologyDecision(BaseModel):
    methodology: Literal["scrum", "kanban", "scrumban", "xp", "shape_up"]
    rationale: str
    sprint_length_weeks: int = Field(description="Length of each iteration in weeks (1-4)")
    ceremonies: list[Ceremony]
    wip_limits: list[WipLimit]
    alternatives: list[Alternative]


# ---------- Software architect ----------


class Component(BaseModel):
    name: str
    responsibility: str
    technology: str


class StackItem(BaseModel):
    layer: str
    technology: str
    reason: str


class ArchitectureDecision(BaseModel):
    title: str
    decision: str
    rationale: str


class Architecture(BaseModel):
    style: str = Field(description="E.g. modular monolith, microservices, serverless")
    summary: str
    components: list[Component]
    stack: list[StackItem]
    decisions: list[ArchitectureDecision]
    rationale: str = Field(description=RATIONALE)


# ---------- Roadmap ----------


class Epic(BaseModel):
    key: str = Field(description="Short identifier, e.g. EP-1")
    title: str
    description: str


class Phase(BaseModel):
    name: str
    goal: str
    start_week: int
    end_week: int
    deliverables: list[str]
    epics: list[Epic]


class Roadmap(BaseModel):
    phases: list[Phase]
    rationale: str = Field(description=RATIONALE)


# ---------- Backlog ----------


class Story(BaseModel):
    key: str = Field(description="Short identifier, e.g. US-1")
    epic_key: str
    title: str
    description: str
    acceptance_criteria: list[str]
    type: Literal["feature", "bug", "chore", "spike"]
    points: int = Field(description="Story points in Fibonacci: 1, 2, 3, 5, 8, 13")
    priority: Level
    role: str = Field(description="Team role best suited for the story")


class Backlog(BaseModel):
    stories: list[Story]
    rationale: str = Field(description=RATIONALE)


# ---------- Sprint planner ----------


class SprintPlan(BaseModel):
    number: int
    name: str
    goal: str
    phase: str
    story_keys: list[str]


class Assignment(BaseModel):
    story_key: str
    member_name: str


class SprintPlanning(BaseModel):
    sprints: list[SprintPlan]
    assignments: list[Assignment]
    rationale: str = Field(description=RATIONALE)


# ---------- Writer: specs and diagrams (spec 006) ----------


class GeneralSpec(BaseModel):
    title: str = Field(description="E.g. 'General spec: <product name>'")
    markdown: str = Field(description="The whole spec in Markdown, with the structure of SPEC_STRUCTURE")
    rationale: str = Field(description=RATIONALE)


class EpicSpec(BaseModel):
    epic_key: str = Field(description="Key of the roadmap epic this spec describes, e.g. EP-2")
    title: str
    markdown: str = Field(description="The whole spec in Markdown, with the structure of SPEC_STRUCTURE")
    rationale: str = Field(description=RATIONALE)


class Diagram(BaseModel):
    title: str
    kind: Literal["flow", "architecture"]
    mermaid: str = Field(description="Mermaid source, starting with its type (e.g. 'flowchart TD')")


class FlowDiagrams(BaseModel):
    diagrams: list[Diagram] = Field(description="One architecture diagram plus one flow per main user journey")
    rationale: str = Field(description=RATIONALE)


class DiagramProposal(Diagram):
    """What one `flow_diagram:<n>` proposal carries: each diagram is approved on its own.
    The check runs here too, so an adjusted diagram that wouldn't render is refused (422)."""

    rationale: str = ""

    @field_validator("mermaid")
    @classmethod
    def _renders(cls, value: str) -> str:
        issues = check_mermaid(value)
        if issues:
            raise ValueError(" ".join(issues))
        return value


# ---------- Stages ----------


@dataclass(frozen=True)
class PlanningStage:
    key: str  # key of the result in the plan context
    title: str  # agent name shown to the user
    schema: type[BaseModel]
    inputs: tuple[str, ...]  # previous results it needs as context


# Inputs that aren't a previous stage: "project" (data and team) and "capacity" (derived from
# the team and the approved iteration length, spec 002 FR-010).
PLANNING_STAGES: tuple[PlanningStage, ...] = (
    PlanningStage("analysis", "Product analyst", Analysis, ("project",)),
    PlanningStage("methodology", "Agile coach", MethodologyDecision, ("project", "analysis")),
    PlanningStage("architecture", "Software architect", Architecture, ("project", "analysis", "methodology")),
    PlanningStage("roadmap", "Product manager", Roadmap, ("project", "analysis", "methodology", "architecture")),
    PlanningStage("backlog", "Product owner", Backlog, ("project", "architecture", "roadmap")),
    PlanningStage(
        "sprints", "Scrum master", SprintPlanning, ("project", "methodology", "roadmap", "backlog", "capacity")
    ),
)

# The writer's stages (spec 006). They run once the plan is complete, through the same
# PlanningAgents port; "epic" and "stories" are derived per roadmap epic (one call each).
DOCUMENT_STAGES: tuple[PlanningStage, ...] = (
    PlanningStage("general_spec", "Spec writer", GeneralSpec, ("project", "analysis", "architecture", "roadmap", "backlog")),
    PlanningStage("epic_spec", "Spec writer", EpicSpec, ("project", "epic", "stories")),
    PlanningStage("flow_diagrams", "Diagram writer", FlowDiagrams, ("project", "analysis", "architecture", "roadmap")),
)

_DOCUMENT_STAGES = {stage.key: stage for stage in DOCUMENT_STAGES}


def document_stage(key: str) -> PlanningStage:
    if key not in _DOCUMENT_STAGES:
        raise StageNotFound(key)
    return _DOCUMENT_STAGES[key]


_BY_KEY = {stage.key: stage for stage in PLANNING_STAGES}


def stage_by_key(key: str) -> PlanningStage:
    if key not in _BY_KEY:
        raise StageNotFound(key)
    return _BY_KEY[key]


def next_stage(key: str) -> PlanningStage | None:
    """The stage after `key`, or None after the last one (sprints)."""
    index = PLANNING_STAGES.index(stage_by_key(key))
    return PLANNING_STAGES[index + 1] if index + 1 < len(PLANNING_STAGES) else None


def first_pending_stage(approved_keys: Iterable[str]) -> PlanningStage | None:
    """The first stage, in order, without an approved (or adjusted) proposal; None = plan complete.
    Resuming after an error starts here, so approved stages never run again (FR-012)."""
    approved = set(approved_keys)
    return next((stage for stage in PLANNING_STAGES if stage.key not in approved), None)


# ---------- Consistency rules (beyond the schema) ----------
#
# The schema says an output can be displayed; these rules say it makes sense with the
# approved context. Each issue is a sentence the agent gets back as feedback on its retry.


def _methodology_issues(output: dict[str, Any], context: dict[str, Any]) -> list[str]:
    requested = (context.get("project") or {}).get("requested_methodology", "auto")
    if requested != "auto":
        if output["methodology"] != requested:
            return [f"The leader chose '{requested}': the methodology must be '{requested}', not '{output['methodology']}'."]
        return []
    if len(output["alternatives"]) < 2:
        return ["List at least two discarded alternatives, each with why_not."]
    return []


def _epic_keys(roadmap: dict[str, Any] | None) -> set[str]:
    return {epic["key"] for phase in (roadmap or {}).get("phases", []) for epic in phase.get("epics", [])}


def _backlog_issues(output: dict[str, Any], context: dict[str, Any]) -> list[str]:
    issues: list[str] = []
    epics = _epic_keys(context.get("roadmap"))
    seen: set[str] = set()
    for story in output["stories"]:
        if story["key"] in seen:
            issues.append(f"Story key {story['key']} is repeated: keys must be unique.")
        seen.add(story["key"])
        if story["epic_key"] not in epics:
            issues.append(f"Story {story['key']} belongs to epic {story['epic_key']}, which isn't in the roadmap.")
    return issues


def _sprints_issues(output: dict[str, Any], context: dict[str, Any]) -> list[str]:
    issues: list[str] = []
    stories = {s["key"]: s for s in (context.get("backlog") or {}).get("stories", [])}
    placed: dict[str, int] = {}
    for sprint in output["sprints"]:
        for key in sprint["story_keys"]:
            if key not in stories:
                issues.append(f"Iteration {sprint['number']} has story {key}, which isn't in the backlog.")
            placed[key] = placed.get(key, 0) + 1
    for key in stories:
        if placed.get(key, 0) == 0:
            issues.append(f"Story {key} isn't in any iteration.")
        elif placed[key] > 1:
            issues.append(f"Story {key} is in {placed[key]} iterations: it must be in exactly one.")

    members = {m["name"] for m in (context.get("project") or {}).get("members", [])}
    for assignment in output["assignments"]:
        if assignment["member_name"] not in members:
            issues.append(f"{assignment['member_name']} isn't on the team: use a member's exact name.")
        if assignment["story_key"] not in stories:
            issues.append(f"The assignment of {assignment['story_key']} refers to a story that isn't in the backlog.")

    # Kanban has a continuous board without sprint capacity (spec 003).
    continuous = (context.get("methodology") or {}).get("methodology") == "kanban"
    capacity = (context.get("capacity") or {}).get("points_per_sprint")
    if not continuous and capacity is not None:
        for sprint in output["sprints"]:
            keys = [k for k in sprint["story_keys"] if k in stories]
            points = sum(stories[k]["points"] for k in keys)
            # A single story bigger than the capacity can't be split here: it gets its own iteration.
            if points > capacity and len(keys) > 1:
                issues.append(f"Iteration {sprint['number']} has {points} points, over the team's capacity of {capacity}.")
    return issues


_RULES = {"methodology": _methodology_issues, "backlog": _backlog_issues, "sprints": _sprints_issues}


def validate_stage_output(stage_key: str, output: dict[str, Any], context: dict[str, Any]) -> list[str]:
    """Consistency issues of a schema-valid stage output against its context (FR-008 to FR-010).
    `output` is the output dumped as JSON; `context` is what the agent received. Empty = valid."""
    rule = _RULES.get(stage_key)
    return rule(output, context) if rule else []

# ---------- Code reviewer (spec 007, US4) ----------
# Not a planning stage: it runs on its own when a PR that closes a project issue is opened.


class ReviewFinding(BaseModel):
    criterion: str = Field(description="The acceptance criterion this remark is about")
    status: Literal["met", "partial", "not_met", "unclear"]
    comment: str = Field(description="Why: what in the diff supports the status")


class CodeReview(BaseModel):
    summary: str = Field(description="What the PR does, in 2-3 sentences")
    findings: list[ReviewFinding]
    risks: list[str] = Field(description="Bugs, missing tests or side effects worth checking")
    reviewed_fully: bool = Field(description="False if part of the diff wasn't reviewed (e.g. too big)")
    rationale: str = Field(description="Overall assessment and what the reviewers should focus on")


CODE_REVIEW_STAGE = PlanningStage("code_review", "Code reviewer", CodeReview, ("task", "diff"))


# ---------- Replanning (spec 008, US2) ----------
# Not a planning stage either: it runs on an applied plan, on demand or when the plan drifts.

ReplanChangeKind = Literal["move", "reassign", "add", "discard"]
ChangeStatus = Literal["backlog", "todo", "in_progress", "review", "done"]


class ReplanChange(BaseModel):
    kind: ReplanChangeKind
    task_key: str | None = Field(default=None, description="The board task it changes (move, reassign, discard)")
    to_sprint: int | None = Field(default=None, description="Sprint number for move/add; null = the backlog")
    to_member: str | None = Field(default=None, description="Exact member name for reassign")
    new_story: Story | None = Field(default=None, description="The story to add (add only)")
    expected_status: ChangeStatus | None = Field(
        default=None, description="The task's current status on the board; the change is skipped if it changed"
    )
    rationale: str = Field(description="Why this change, in one or two sentences")


class Replan(BaseModel):
    changes: list[ReplanChange]
    rationale: str = Field(description=RATIONALE)


class ReplanContent(Replan):
    """Content of a `replan` proposal: the agent's output plus the reason it was asked for.
    The leader adjusts it by removing changes (FR-013)."""

    reason: str = ""


# Inputs: the project and team, the approved plan, the current board, the real velocity and the reason.
REPLAN_STAGE = PlanningStage("replan", "Scrum master", Replan, ("project", "plan", "board", "velocity", "reason"))


def _same(a: str, b: str) -> bool:
    return " ".join(a.split()).casefold() == " ".join(b.split()).casefold()


def validate_replan(output: dict[str, Any], context: dict[str, Any]) -> list[str]:
    """Consistency issues of a replan against the board it was made for: changes only refer
    to existing tasks, open sprints and team members, and never touch a done task (FR-011)."""
    board = context.get("board") or {}
    tasks = {t["key"]: t for t in board.get("tasks", [])}
    open_sprints = {s["number"] for s in board.get("sprints", []) if not s.get("closed")}
    members = [m["name"] for m in (context.get("project") or {}).get("members", [])]
    issues: list[str] = []
    added: set[str] = set()

    def check_sprint(change: dict[str, Any], label: str) -> None:
        number = change.get("to_sprint")
        if number is not None and number not in open_sprints:
            issues.append(f"{label}: sprint {number} doesn't exist or is closed; use an open sprint's number or null for the backlog.")

    for i, change in enumerate(output.get("changes", []), 1):
        kind, key = change["kind"], change.get("task_key")
        label = f"Change {i} ({kind} {key})" if key else f"Change {i} ({kind})"
        if kind == "add":
            story = change.get("new_story")
            if not story:
                issues.append(f"{label}: an add needs new_story.")
                continue
            if story["key"] in tasks or story["key"] in added:
                issues.append(f"{label}: the key {story['key']} is already used; give the new story a unique key.")
            added.add(story["key"])
            check_sprint(change, label)
            continue
        if not key or key not in tasks:
            issues.append(f"{label}: {key or 'the task_key'} isn't a task on the board.")
            continue
        task = tasks[key]
        if task["status"] == "done":
            issues.append(f"{label}: {key} is done, and done tasks never change.")
            continue
        if change.get("expected_status") != task["status"]:
            issues.append(f"{label}: expected_status must be {key}'s current status, '{task['status']}'.")
        if kind == "move":
            check_sprint(change, label)
        elif kind == "reassign":
            member = change.get("to_member")
            if not member or not any(_same(member, name) for name in members):
                issues.append(f"{label}: {member or 'to_member'} isn't on the team; use a member's exact name.")
    return issues


_RULES["replan"] = validate_replan
