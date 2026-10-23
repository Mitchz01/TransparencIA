"""SQLModel tables. Only this adapter knows them; everything else uses the domain/ entities."""

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


def _now() -> datetime:
    return datetime.now(timezone.utc)


class ProjectTable(SQLModel, table=True):
    __tablename__ = "project"

    id: int | None = Field(default=None, primary_key=True)
    name: str
    description: str
    duration_weeks: int = 8
    requested_methodology: str = "auto"
    status: str = "draft"
    auto_approve: bool = False
    repository: str | None = None
    plan: dict[str, Any] | None = Field(default=None, sa_column=Column(JSON))
    sprint_capacity_override: int | None = None
    created_at: datetime = Field(default_factory=_now)
    # Spec 007. Encrypted with SECRET_KEY when it's set (see token_cipher.py), plain text otherwise.
    github_token: str | None = None
    webhook_id: int | None = None


class MemberTable(SQLModel, table=True):
    __tablename__ = "member"

    id: int | None = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id", index=True)
    name: str
    role: str
    seniority: str = "mid"
    hours_per_week: int = 20
    skills: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    # Removed members are deactivated, never deleted, so done tasks keep their assignee (spec 001).
    active: bool = True
    github_username: str | None = None  # spec 007


class SprintTable(SQLModel, table=True):
    __tablename__ = "sprint"

    id: int | None = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id", index=True)
    number: int
    name: str
    goal: str
    phase: str = ""


class TaskTable(SQLModel, table=True):
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
    checklist: list[dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSON))
    type: str = "feature"
    points: int = 1
    priority: str = "medium"
    status: str = "backlog"
    position: int = 0
    missing_role: str | None = None


class ObjectiveTable(SQLModel, table=True):
    __tablename__ = "objective"

    id: int | None = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id", index=True)
    sprint_id: int = Field(foreign_key="sprint.id")
    title: str
    done: bool = False


class ProposalTable(SQLModel, table=True):
    __tablename__ = "proposal"

    id: int | None = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id", index=True)
    kind: str
    key: str
    agent: str
    content: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    rationale: str = ""
    status: str = "pending"
    adjusted_content: dict[str, Any] | None = Field(default=None, sa_column=Column(JSON))
    rejection_reason: str | None = None
    auto_approved: bool = False
    origin: str = "leader"
    apply_failed: bool = False
    apply_error: str | None = None
    created_at: datetime = Field(default_factory=_now)
    resolved_at: datetime | None = None
    result: dict[str, Any] | None = Field(default=None, sa_column=Column(JSON))


class ActivityTable(SQLModel, table=True):
    """One row per domain event. The autoincrement id is the event's `seq` (spec 005)."""

    __tablename__ = "activity"

    id: int | None = Field(default=None, primary_key=True)
    project_id: int = Field(index=True)
    type: str
    occurred_at: datetime = Field(default_factory=_now)
    payload: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))


class ExternalLinkTable(SQLModel, table=True):
    """Task ↔ issue/PR (spec 007). A task has at most one live issue link."""

    __tablename__ = "external_link"

    id: int | None = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id", index=True)
    task_id: int = Field(foreign_key="task.id", index=True)
    kind: str
    repository: str = Field(index=True)
    number: int
    url: str
    state: str = "open"
    broken: bool = False


class OwnWriteTable(SQLModel, table=True):
    """A write the system made on GitHub; spec 008 consumes it to ignore the echo (spec 007, FR-023)."""

    __tablename__ = "own_write"

    id: int | None = Field(default=None, primary_key=True)
    repository: str = Field(index=True)
    number: int
    action: str
    created_at: datetime = Field(default_factory=_now)
    consumed_at: datetime | None = None
