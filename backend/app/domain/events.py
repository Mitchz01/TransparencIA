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


class Resync(DomainEvent):
    """Sent on reconnect when more events were missed than the stream replays (spec 005, FR-015):
    the client refetches its state with the regular GET endpoints."""

    type: Literal["resync"] = "resync"


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
    sprint_id: int | None = None
    position: int | None = None


class TaskUpdated(DomainEvent):
    """A task's data or checklist was edited (moves publish TaskStatusChanged)."""

    type: Literal["task_updated"] = "task_updated"
    actor: Actor = "person"
    task_id: int
    fields: list[str]


class PlanApplied(DomainEvent):
    """The approved plan became a board (contract 005 → 003)."""

    type: Literal["plan_applied"] = "plan_applied"
    sprints: int
    tasks: int
    skipped_story_keys: list[str] = []


# ---------- GitHub integration (spec 007) ----------
# Every action taken on GitHub is recorded in the activity (FR-020): what, when and which
# proposal authorized it (`proposal_id`; None for issue updates caused by a person, FR-021).


class RepositoryConnected(DomainEvent):
    type: Literal["repository_connected"] = "repository_connected"
    actor: Actor = "person"
    repository: str
    replaced: str | None = None
    mode: str = "github"
    webhook_registered: bool = False


class RepositoryDisconnected(DomainEvent):
    type: Literal["repository_disconnected"] = "repository_disconnected"
    actor: Actor = "person"
    repository: str


class PublishedIssue(BaseModel):
    task_id: int
    number: int


class FailedIssue(BaseModel):
    task_id: int
    error: str


class IssuesPublished(DomainEvent):
    type: Literal["issues_published"] = "issues_published"
    proposal_id: int
    created: list[PublishedIssue]
    failed: list[FailedIssue]


class IssueUpdated(DomainEvent):
    type: Literal["issue_updated"] = "issue_updated"
    task_id: int
    number: int
    broken: bool = False  # the issue was deleted on GitHub


class IssueClosed(DomainEvent):
    type: Literal["issue_closed"] = "issue_closed"
    task_id: int
    number: int
    reason: str


class ReviewRequested(DomainEvent):
    type: Literal["review_requested"] = "review_requested"
    proposal_id: int
    pr_number: int
    reviewers: list[str]
