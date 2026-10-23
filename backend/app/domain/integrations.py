"""GitHub integration (spec 007): links between tasks and issues/PRs, the writes the system
makes on GitHub, and the pure rules to publish issues and suggest reviewers."""

import re
from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field

from app.domain.errors import ValidationFailed

ExternalKind = Literal["issue", "pull_request"]
ExternalState = Literal["open", "closed", "merged"]


def _now() -> datetime:
    return datetime.now(timezone.utc)


class IssueRef(BaseModel):
    number: int
    url: str
    state: ExternalState = "open"
    # The issue was deleted on GitHub: the card shows the link as broken (spec 007, edge cases).
    broken: bool = False


class PullRequestRef(BaseModel):
    number: int
    url: str
    state: ExternalState = "open"
    # Issues the PR closes ("Closes #12").
    closes: list[int] = []


class ExternalLink(BaseModel):
    """Task ↔ issue/PR link. Our board is the source of truth:
    only state changes come in from GitHub."""

    id: int | None = None
    project_id: int = 0
    task_id: int
    kind: ExternalKind
    # The repo the issue/PR lives in: links survive a repo switch (spec 007, edge cases).
    repository: str = ""
    number: int
    url: str
    state: ExternalState = "open"
    broken: bool = False

    def issue_ref(self) -> IssueRef:
        """The `issue` field of a board task (spec 003's read model)."""
        return IssueRef(number=self.number, url=self.url, state=self.state, broken=self.broken)


# ---------- Own writes (FR-023 ↔ spec 008 FR-015) ----------

# What the system did on GitHub; spec 008 matches the webhook events against it.
OwnWriteAction = Literal["issue_opened", "issue_edited", "issue_closed", "review_requested", "commented"]


class OwnWrite(BaseModel):
    """A write the system made on GitHub. The webhook event it causes is ignored once
    (spec 008 consumes the record), so it never comes back in as team progress."""

    id: int | None = None
    repository: str
    number: int  # issue or PR number (they share GitHub's numbering)
    action: OwnWriteAction
    created_at: datetime = Field(default_factory=_now)
    consumed_at: datetime | None = None


# ---------- Repository access (US1) ----------

RepoAccessReason = Literal["not_found", "forbidden", "missing_permissions"]

REPOSITORY_PATTERN = re.compile(r"^[A-Za-z0-9-]{1,39}/[A-Za-z0-9._-]{1,100}$")


class RepoAccess(BaseModel):
    """What the token can do on a repo, as the code host reports it."""

    status: Literal["ok", "not_found", "forbidden", "missing_permissions"]
    url: str = ""  # web URL of the repo
    can_write: bool = False  # create issues, comment, request reviews
    can_admin: bool = False  # manage webhooks

    def problem(self, *, needs_webhook: bool) -> RepoAccessReason | None:
        """Why the repo can't be connected, or None if it can (FR-002)."""
        if self.status != "ok":
            return self.status
        if not self.can_write or (needs_webhook and not self.can_admin):
            return "missing_permissions"
        return None


def validate_repository(value: str) -> str:
    """`owner/name`, trimmed; raises ValidationFailed on the `repository` field."""
    clean = value.strip()
    if not REPOSITORY_PATTERN.match(clean):
        raise ValidationFailed.single("repository", "Must be owner/name, e.g. acme/agile-app.")
    return clean
