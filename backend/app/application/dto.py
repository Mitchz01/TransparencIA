"""Use case inputs and outputs. The HTTP adapter uses them as body/response."""

from pydantic import BaseModel

from app.domain.board import Sprint, Task, TaskStatus
from app.domain.project import Project, RequestedMethodology, Seniority


class MemberCreate(BaseModel):
    name: str
    role: str
    seniority: Seniority = "mid"
    hours_per_week: int = 20
    skills: list[str] = []


class ProjectCreate(BaseModel):
    name: str
    description: str
    duration_weeks: int = 8
    requested_methodology: RequestedMethodology = "auto"
    auto_approve: bool = False
    members: list[MemberCreate]


class ProjectDetail(BaseModel):
    project: Project
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
