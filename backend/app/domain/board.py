from typing import Literal

from pydantic import BaseModel

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
