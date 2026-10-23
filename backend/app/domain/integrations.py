"""GitHub integration (spec 007): links between tasks and issues/PRs, the writes the system
makes on GitHub, and the pure rules to publish issues and suggest reviewers."""

import re
from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field

from app.domain.board import Task
from app.domain.errors import ValidationFailed
from app.domain.plan import CodeReview
from app.domain.project import Member

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


# ---------- GitHub usernames (US3) ----------

# 1-39 chars: letters, digits and single hyphens, not at the start or the end (GitHub's rule).
GITHUB_USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$")


def validate_github_username(value: str | None) -> str | None:
    """Trimmed username, or None to remove it; raises ValidationFailed on `github_username`."""
    if value is None:
        return None
    clean = value.strip().lstrip("@")
    if not GITHUB_USERNAME_PATTERN.match(clean):
        raise ValidationFailed.single(
            "github_username", "Must be a GitHub username: up to 39 letters, digits or single hyphens, not at the start or end."
        )
    return clean


# ---------- Publishing issues (US2) ----------

ISSUE_FOOTER = "_Managed by Agile Planner (task {key}): edit the task on the board, changes made here are overwritten._"


def issue_body(task: Task) -> str:
    """The issue mirrors the task (FR-008): description, acceptance criteria and the
    checklist as a GitHub task list. Empty sections are left out."""
    parts: list[str] = []
    if task.description.strip():
        parts.append(task.description.strip())
    if task.acceptance_criteria:
        parts.append("## Acceptance criteria\n\n" + "\n".join(f"- {c}" for c in task.acceptance_criteria))
    if task.checklist:
        parts.append("## Checklist\n\n" + "\n".join(f"- [{'x' if i.done else ' '}] {i.text}" for i in task.checklist))
    parts.append("---\n" + ISSUE_FOOTER.format(key=task.key))
    return "\n\n".join(parts)


def issue_labels(task: Task) -> list[str]:
    return [f"type:{task.type}", f"priority:{task.priority}"]


class IssueToPublish(BaseModel):
    task_id: int
    key: str = ""
    title: str


class IssuesToPublish(BaseModel):
    """Content of a `github_action` / `create_issues` proposal. The leader adjusts it by
    removing tasks (FR-007)."""

    repository: str
    tasks: list[IssueToPublish] = Field(min_length=1)


# ---------- Code review (US4) ----------

# "Closes #12", "fixes: #3", "Resolved #7"... GitHub's closing keywords, case-insensitive.
CLOSING_REF = re.compile(r"\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s*:?\s+#(\d+)\b", re.IGNORECASE)


def closing_refs(body: str | None) -> list[int]:
    """Issue numbers a PR body closes, in order and without repeats."""
    numbers: list[int] = []
    for match in CLOSING_REF.finditer(body or ""):
        number = int(match.group(1))
        if number not in numbers:
            numbers.append(number)
    return numbers


class SuggestedReviewer(BaseModel):
    github_username: str
    member_id: int | None = None
    name: str = ""
    reason: str = ""


def pick_reviewers(
    members: list[Member], *, author: str, role: str | None, pending_reviews: dict[int, int]
) -> list[SuggestedReviewer]:
    """FR-014: the member with `role` and the fewest pending reviews, never the PR author.
    If nobody else has that role, the member with a GitHub username and the fewest pending
    reviews, saying why; nobody if no one else has a username (spec 007, edge cases)."""
    candidates = [m for m in members if m.github_username and m.github_username.lower() != author.lower()]
    if not candidates:
        return []

    def load(member: Member) -> tuple[int, str, int]:
        return (pending_reviews.get(member.id or 0, 0), member.name.casefold(), member.id or 0)

    same_role = [m for m in candidates if role and m.role.casefold() == role.casefold()]
    best = min(same_role or candidates, key=load)
    pending = pending_reviews.get(best.id or 0, 0)
    if same_role:
        reason = f"{best.role} like the task, with the fewest pending reviews ({pending})."
    elif role:
        reason = f"Nobody else with the {role} role has a GitHub username; {best.name} ({best.role}) has the fewest pending reviews ({pending})."
    else:
        reason = f"The member with the fewest pending reviews ({pending})."
    return [SuggestedReviewer(github_username=best.github_username or "", member_id=best.id, name=best.name, reason=reason)]


_STATUS_LABELS = {"met": "Met", "partial": "Partially met", "not_met": "Not met", "unclear": "Unclear"}


def review_comment(review: CodeReview) -> str:
    """The agent's review as a PR comment (markdown). The leader can edit it (FR-016)."""
    parts = ["## Review against the acceptance criteria", review.summary.strip()]
    if review.findings:
        rows = [f"| {f.criterion} | {_STATUS_LABELS[f.status]} | {f.comment} |" for f in review.findings]
        parts.append("| Criterion | Status | Comment |\n|---|---|---|\n" + "\n".join(rows))
    if review.risks:
        parts.append("**Risks**\n\n" + "\n".join(f"- {r}" for r in review.risks))
    if review.rationale.strip():
        parts.append(review.rationale.strip())
    if not review.reviewed_fully:
        parts.append("_The PR was too big to review entirely: only part of the diff was reviewed._")
    return "\n\n".join(p for p in parts if p)


def agent_comment(body: str, proposal_id: int) -> str:
    """The comment as posted, marked as generated by an agent (FR-017)."""
    return f"{body.strip()}\n\n---\n_Generated by the Agile Planner code reviewer agent and approved in proposal #{proposal_id}._"


class ReviewToRequest(BaseModel):
    """Content of a `github_action` / `request_review` proposal. The leader can change the
    reviewers or edit the comment before approving (FR-016)."""

    repository: str
    pr_number: int
    pr_url: str
    author: str
    task_ids: list[int]
    reviewers: list[SuggestedReviewer] = []
    comment: str = Field(min_length=1)
    review: CodeReview
