"""Entidades del dominio.

No dependen de FastAPI, SQLModel ni ADK: los adaptadores las convierten
desde y hacia sus propios formatos (filas, JSON de la API, etc.).
"""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

ProjectStatus = Literal["draft", "planning", "ready", "error"]
TaskStatus = Literal["backlog", "todo", "in_progress", "review", "done"]
RequestedMethodology = Literal["auto", "scrum", "kanban", "scrumban", "xp", "shape_up"]


class Member(BaseModel):
    id: int | None = None
    project_id: int | None = None
    name: str
    role: str
    seniority: str = "mid"
    hours_per_week: int = 20
    skills: list[str] = Field(default_factory=list)


class Project(BaseModel):
    id: int | None = None
    name: str
    description: str
    duration_weeks: int = 8
    requested_methodology: RequestedMethodology = "auto"
    status: ProjectStatus = "draft"
    # analysis, methodology, architecture y roadmap generados por los agentes
    plan: dict[str, Any] | None = None
    created_at: datetime | None = None


class Sprint(BaseModel):
    id: int | None = None
    project_id: int | None = None
    number: int
    name: str
    goal: str
    phase: str = ""


class Task(BaseModel):
    id: int | None = None
    project_id: int | None = None
    sprint_id: int | None = None
    assignee_id: int | None = None
    key: str
    epic_key: str = ""
    title: str
    description: str = ""
    acceptance_criteria: list[str] = Field(default_factory=list)
    type: str = "feature"
    points: int = 1
    priority: str = "medium"
    status: TaskStatus = "backlog"
    position: int = 0
