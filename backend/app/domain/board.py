from collections.abc import Iterable
from typing import Literal

from pydantic import BaseModel

from app.domain.capacity import team_capacity
from app.domain.plan import WipLimit
from app.domain.project import Project

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
