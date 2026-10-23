"""SQLModel tables. Only this adapter knows them; everything else uses the domain/ entities."""

from datetime import date, datetime, timezone
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
    closed: bool = False  # spec 008
    end_date: date | None = None  # spec 008


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


class WebhookDeliveryTable(SQLModel, table=True):
    """A received GitHub delivery, to process each one once (spec 008, FR-003)."""

    __tablename__ = "webhook_delivery"

    id: int | None = Field(default=None, primary_key=True)
    delivery_id: str = Field(unique=True, index=True)
    event: str
    received_at: datetime = Field(default_factory=_now)


class OwnWriteTable(SQLModel, table=True):
    """A write the system made on GitHub; spec 008 consumes it to ignore the echo (spec 007, FR-023)."""

    __tablename__ = "own_write"

    id: int | None = Field(default=None, primary_key=True)
    repository: str = Field(index=True)
    number: int
    action: str
    created_at: datetime = Field(default_factory=_now)
    consumed_at: datetime | None = None


class DocumentTable(SQLModel, table=True):
    __tablename__ = "document"

    id: int | None = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id", index=True)
    key: str  # the proposal key that versions it: "general_spec", "epic_spec:EP-2", "flow_diagram:1"
    kind: str
    epic_key: str | None = None
    title: str
    content: str  # the latest version's, so reading a document needs no join
    version: int = 1
    outdated: bool = False
    updated_at: datetime = Field(default_factory=_now)


class DocumentVersionTable(SQLModel, table=True):
    """Every approved content of a document; never deleted (spec 006, FR-008)."""

    __tablename__ = "document_version"

    id: int | None = Field(default=None, primary_key=True)
    document_id: int = Field(foreign_key="document.id", index=True)
    version: int
    content: str
    source: str = "agent"
    proposal_id: int | None = Field(default=None, foreign_key="proposal.id")
    created_at: datetime = Field(default_factory=_now)
