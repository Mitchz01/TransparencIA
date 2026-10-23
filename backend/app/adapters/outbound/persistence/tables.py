"""Tablas SQLModel. Detalle de persistencia: el dominio no las conoce.

Para pasar a entidades: `Project.model_validate(row, from_attributes=True)`.
"""

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


def _now() -> datetime:
    return datetime.now(timezone.utc)


class ProjectRow(SQLModel, table=True):
    __tablename__ = "project"

    id: int | None = Field(default=None, primary_key=True)
    name: str
    description: str
    duration_weeks: int = 8
    requested_methodology: str = "auto"
    status: str = "draft"
    plan: dict[str, Any] | None = Field(default=None, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=_now)


class MemberRow(SQLModel, table=True):
    __tablename__ = "member"

    id: int | None = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id", index=True)
    name: str
    role: str
    seniority: str = "mid"
    hours_per_week: int = 20
    skills: list[str] = Field(default_factory=list, sa_column=Column(JSON))


class SprintRow(SQLModel, table=True):
    __tablename__ = "sprint"

    id: int | None = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id", index=True)
    number: int
    name: str
    goal: str
    phase: str = ""


class TaskRow(SQLModel, table=True):
    __tablename__ = "task"

    id: int | None = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id", index=True)
    sprint_id: int | None = Field(default=None, foreign_key="sprint.id")
    assignee_id: int | None = Field(default=None, foreign_key="member.id")
    key: str
    epic_key: str = ""
    title: str
    description: str = ""
    acceptance_criteria: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    type: str = "feature"
    points: int = 1
    priority: str = "medium"
    status: str = "backlog"
    position: int = 0
