"""SQLModel tables. Only this adapter knows them; everything else uses the domain/ entities."""

import datetime as dt
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import JSON, Column, LargeBinary
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
    invite_token: str | None = Field(default=None, index=True)  # spec 015
    public: bool = False  # spec 017
    public_slug: str | None = Field(default=None, unique=True, index=True)  # spec 017


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
    account_id: int | None = Field(default=None, foreign_key="account.id", index=True)  # spec 015
    permission: str = "member"  # spec 015
    avatar_url: str | None = None  # spec 015, FR-005 amended


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
    done_at: datetime | None = None  # spec 017


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


# ---------- Accounts (spec 015) ----------


class AccountTable(SQLModel, table=True):
    __tablename__ = "account"

    id: int | None = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)  # normalized: lowercase, trimmed
    password_hash: str
    name: str
    role: str | None = None
    seniority: str = "mid"
    hours_per_week: int = 20
    skills: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    github_username: str | None = None
    avatar_url: str | None = None  # FR-005 amended
    created_at: datetime = Field(default_factory=_now)


class SessionTable(SQLModel, table=True):
    __tablename__ = "auth_session"

    id: int | None = Field(default=None, primary_key=True)
    account_id: int = Field(foreign_key="account.id", index=True)
    token_digest: str = Field(unique=True, index=True)  # SHA-256 of the cookie's token, never the token
    created_at: datetime = Field(default_factory=_now)
    expires_at: datetime


# ---------- Transparency portal (spec 017) ----------


class BudgetTable(SQLModel, table=True):
    """One row per project; the lines travel as JSON because nothing queries them on their own."""

    __tablename__ = "budget"

    project_id: int = Field(primary_key=True, foreign_key="project.id")
    contracting_entity: str
    contractor: str
    contract_value: int
    start_date: date
    lines: list[dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSON))


class StoredFileTable(SQLModel, table=True):
    """An uploaded piece of evidence, kept as bytes (D4)."""

    __tablename__ = "stored_file"

    id: int | None = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id", index=True)
    name: str
    mime: str
    data: bytes = Field(sa_column=Column(LargeBinary))


class ExpenseTable(SQLModel, table=True):
    __tablename__ = "expense"

    id: int | None = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id", index=True)
    file_id: int = Field(foreign_key="stored_file.id")
    mime: str
    kind: str
    status: str = "draft"
    amount: int | None = None
    date: dt.date | None = None  # the field shadows the `date` import inside this class
    supplier: str | None = None
    concept: str | None = None
    budget_line_id: str | None = None
    task_id: int | None = None  # no foreign key: the evidence outlives a deleted task and keeps its title
    task_title: str | None = None
    citizen_summary: str = ""
    created_at: datetime = Field(default_factory=_now)


class AlertTable(SQLModel, table=True):
    __tablename__ = "alert"

    id: int | None = Field(default=None, primary_key=True)
    expense_id: int = Field(foreign_key="expense.id", index=True)
    level: str
    reason: str
    source: str
    answer: str | None = None
    answered_at: datetime | None = None
