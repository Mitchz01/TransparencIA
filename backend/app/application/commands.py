"""Datos de entrada y salida de los casos de uso.

Los adaptadores de entrada (HTTP) los usan como cuerpo de request y respuesta.
"""

from pydantic import BaseModel, Field

from app.domain.entities import Member, Project, RequestedMethodology, Sprint, Task, TaskStatus


class MemberCreate(BaseModel):
    name: str
    role: str
    seniority: str = "mid"
    hours_per_week: int = 20
    skills: list[str] = Field(default_factory=list)


class ProjectCreate(BaseModel):
    name: str
    description: str
    duration_weeks: int = 8
    requested_methodology: RequestedMethodology = "auto"
    members: list[MemberCreate]


class ProjectDetail(BaseModel):
    project: Project
    members: list[Member]
    sprints: list[Sprint]
    tasks: list[Task]


class TaskUpdate(BaseModel):
    status: TaskStatus | None = None
    sprint_id: int | None = None
    assignee_id: int | None = None
    position: int | None = None
    title: str | None = None
    description: str | None = None
    points: int | None = None
