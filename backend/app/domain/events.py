"""Domain events. They're published on the EventBus, saved as the project's activity
and streamed over SSE (spec 005). Every event carries the common fields below, all with
defaults, so publishers only fill what they know."""

from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

Actor = Literal["agent", "person", "github", "system"]


def _now() -> datetime:
    return datetime.now(timezone.utc)


class EventRef(BaseModel):
    kind: str  # "proposal", "task", "document", "member", "project"
    id: int


class DomainEvent(BaseModel):
    # Extra fields are kept, so an event read back from the activity log as a plain
    # DomainEvent still carries its type-specific data.
    model_config = ConfigDict(extra="allow")

    type: str
    project_id: int | None = None
    seq: int | None = None  # set by the event bus when the event is saved
    occurred_at: datetime = Field(default_factory=_now)
    actor: Actor = "system"
    summary: str = ""
    ref: EventRef | None = None


# ---------- Planning (spec 002) ----------


class AgentStarted(DomainEvent):
    type: Literal["agent_started"] = "agent_started"
    actor: Actor = "agent"
    agent: str
    title: str


class AgentFinished(DomainEvent):
    type: Literal["agent_finished"] = "agent_finished"
    actor: Actor = "agent"
    agent: str
    title: str
    output: dict[str, Any]


class PlanFailed(DomainEvent):
    type: Literal["plan_failed"] = "plan_failed"
    agent: str
    error: str


# ---------- Proposals (spec 005) ----------


class ProposalCreated(DomainEvent):
    type: Literal["proposal_created"] = "proposal_created"
    actor: Actor = "agent"
    proposal_id: int
    kind: str = ""
    key: str = ""
    agent: str = ""


class ProposalResolved(DomainEvent):
    type: Literal["proposal_resolved"] = "proposal_resolved"
    actor: Actor = "person"
    proposal_id: int
    kind: str = ""
    key: str = ""
    status: str
    auto: bool = False
    reason: str | None = None


class ProposalApplyFailed(DomainEvent):
    type: Literal["proposal_apply_failed"] = "proposal_apply_failed"
    proposal_id: int
    error: str


# ---------- Team (spec 001) ----------


class MemberChangeInfo(BaseModel):
    member_id: int
    name: str
    fields: list[str]


class TeamChanged(DomainEvent):
    type: Literal["team_changed"] = "team_changed"
    actor: Actor = "person"
    joined: list[str]
    left: list[str]
    changed: list[MemberChangeInfo]


# ---------- Board (spec 003) ----------


class TaskStatusChanged(DomainEvent):
    type: Literal["task_status_changed"] = "task_status_changed"
    task_id: int
    status: str
