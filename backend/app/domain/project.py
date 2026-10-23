from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, Field

ProjectStatus = Literal["draft", "planning", "ready", "error"]
RequestedMethodology = Literal["auto", "scrum", "kanban", "scrumban", "xp", "shape_up"]
Seniority = Literal["junior", "mid", "senior"]


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Member(BaseModel):
    id: int | None = None
    name: str
    role: str
    seniority: Seniority = "mid"
    hours_per_week: int = 20
    skills: list[str] = []


class Objective(BaseModel):
    id: int | None = None
    title: str
    phase: str = ""
    done: bool = False


class Project(BaseModel):
    id: int | None = None
    name: str
    description: str
    duration_weeks: int = 8
    requested_methodology: RequestedMethodology = "auto"
    status: ProjectStatus = "draft"
    # Si está activo, las propuestas de los agentes se aprueban solas (quedan auditadas igual).
    auto_approve: bool = False
    # Repo de GitHub conectado, formato "owner/name". Uno solo por proyecto.
    repository: str | None = None
    # analysis, methodology, architecture, roadmap aprobados
    plan: dict[str, Any] | None = None
    members: list[Member] = []
    created_at: datetime = Field(default_factory=_now)
