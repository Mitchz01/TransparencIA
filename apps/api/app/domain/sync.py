"""GitHub sync (spec 008, US1): the PR and issue events the webhook understands, and the
pure rules that turn them into task states. Our board is the source of truth: only
progress comes in from GitHub, and it's applied without a proposal (FR-001)."""

from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field

from app.domain.board import TaskStatus


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------- Events (what the webhook adapter parses GitHub's payloads into) ----------


class PullRequestEvent(BaseModel):
    repository: str  # owner/name
    number: int  # the PR's number
    closes: list[int] = []  # issues it closes ("Closes #12"), from the PR body


class PullRequestOpened(PullRequestEvent):
    kind: Literal["pull_request_opened"] = "pull_request_opened"
    author: str = ""
    draft: bool = False
    url: str = ""
    body: str = ""


class PullRequestReadyForReview(PullRequestEvent):
    kind: Literal["pull_request_ready_for_review"] = "pull_request_ready_for_review"


class PullRequestMerged(PullRequestEvent):
    kind: Literal["pull_request_merged"] = "pull_request_merged"


class PullRequestClosed(PullRequestEvent):
    """Closed without merging: the PR link is closed, the tasks don't move."""

    kind: Literal["pull_request_closed"] = "pull_request_closed"


IssueCloseReason = Literal["completed", "not_planned"]


class IssueClosed(BaseModel):
    kind: Literal["issue_closed"] = "issue_closed"
    repository: str
    number: int
    reason: IssueCloseReason = "completed"


class IssueReopened(BaseModel):
    kind: Literal["issue_reopened"] = "issue_reopened"
    repository: str
    number: int


GithubEvent = (
    PullRequestOpened | PullRequestReadyForReview | PullRequestMerged | PullRequestClosed | IssueClosed | IssueReopened
)


# ---------- Status rules (spec table in US1) ----------

_ORDER: dict[str, int] = {"backlog": 0, "todo": 1, "in_progress": 2, "review": 3, "done": 4}

_PROGRESS: dict[str, TaskStatus] = {
    "pull_request_opened": "in_progress",
    "pull_request_ready_for_review": "review",
    "pull_request_merged": "done",
}


def next_status(current: TaskStatus, event: GithubEvent) -> TaskStatus | None:
    """The task's new status after `event`, or None if it doesn't move.

    Progress only moves a task forward: a PR opened on a task already in review leaves it
    there, and nothing from GitHub moves a task out of "done" except reopening its issue
    (FR-004). An issue closed as "not planned" never moves the task; the leader decides."""
    if isinstance(event, IssueReopened):
        return "todo" if _ORDER[current] > _ORDER["todo"] else None
    if isinstance(event, IssueClosed):
        target: TaskStatus | None = "done" if event.reason == "completed" else None
    else:
        target = _PROGRESS.get(event.kind)
    if target is None or _ORDER[target] <= _ORDER[current]:
        return None
    return target


def completes_checklist(event: GithubEvent) -> bool:
    """A merged PR leaves its tasks with every checklist item done (FR-005)."""
    return isinstance(event, PullRequestMerged)


# ---------- Deliveries (FR-003) ----------

# Deliveries and consumed own writes older than this are pruned on startup (T028).
SYNC_RECORDS_TTL_DAYS = 7


class WebhookDelivery(BaseModel):
    """A received GitHub delivery: the same `delivery_id` is processed only once."""

    id: int | None = None
    delivery_id: str
    event: str  # X-GitHub-Event
    received_at: datetime = Field(default_factory=_now)
