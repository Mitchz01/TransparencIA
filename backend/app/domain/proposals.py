"""Every agent decision is a proposal: nothing is applied without approval
(manual, or through the project's auto_approve). Lifecycle in spec 005."""

from collections.abc import Sequence
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Literal

from pydantic import BaseModel, Field

from app.domain.errors import ProposalAlreadyResolved, ValidationFailed

if TYPE_CHECKING:
    from app.domain.project import Project

ProposalKind = Literal["plan_stage", "document", "replan", "github_action"]
ProposalStatus = Literal["pending", "approved", "adjusted", "rejected", "discarded"]
# "automatic" = raised by the system on its own (spec 008 drift replans): never auto-approved.
ProposalOrigin = Literal["leader", "automatic"]

MAX_CONSECUTIVE_REJECTIONS = 3
REASON_MAX = 1000


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Proposal(BaseModel):
    id: int | None = None
    project_id: int
    kind: ProposalKind
    key: str  # stage or action, e.g. "methodology", "create_issues", "epic_spec:EP-2"
    agent: str  # who proposed it, e.g. "Agile coach"
    content: dict[str, Any]  # agent output, with its schema
    rationale: str = ""
    status: ProposalStatus = "pending"
    adjusted_content: dict[str, Any] | None = None
    rejection_reason: str | None = None
    auto_approved: bool = False
    origin: ProposalOrigin = "leader"
    # Deciding and applying are separate steps: an approved proposal can fail to apply and be retried.
    apply_failed: bool = False
    apply_error: str | None = None
    created_at: datetime = Field(default_factory=_now)
    resolved_at: datetime | None = None

    @property
    def final_content(self) -> dict[str, Any]:
        return self.adjusted_content if self.status == "adjusted" and self.adjusted_content is not None else self.content

    @property
    def subject(self) -> tuple[str, str]:
        return (self.kind, self.key)

    @property
    def decided(self) -> bool:
        """Approved or adjusted: the ones that get applied."""
        return self.status in ("approved", "adjusted")

    def approve(self, *, auto: bool = False) -> None:
        self._resolve("approved")
        self.auto_approved = auto

    def adjust(self, content: dict[str, Any]) -> None:
        self._resolve("adjusted")
        self.adjusted_content = content

    def reject(self, reason: str) -> None:
        clean = reason.strip()
        if not clean:
            raise ValidationFailed.single("reason", "Required.")
        if len(clean) > REASON_MAX:
            raise ValidationFailed.single("reason", f"Max {REASON_MAX} characters.")
        self._resolve("rejected")
        self.rejection_reason = clean

    def discard(self) -> None:
        """The system replaced this pending proposal with a newer one on the same subject."""
        self._resolve("discarded")

    def adjust_after_limit(self, content: dict[str, Any], history: Sequence["Proposal"]) -> None:
        """The leader writes their own version on the newest rejected proposal of a subject
        that reached MAX_CONSECUTIVE_REJECTIONS (spec 002 FR-011, spec 005 US4)."""
        if not self.can_adjust_after_limit(history):
            raise ProposalAlreadyResolved(self.id, self.status)
        self.status = "adjusted"
        self.adjusted_content = content
        self.resolved_at = _now()

    def can_adjust_after_limit(self, history: Sequence["Proposal"]) -> bool:
        same = sorted((p for p in history if p.subject == self.subject), key=_order)
        return (
            self.status == "rejected"
            and bool(same)
            and same[-1].id == self.id
            and consecutive_rejections(same) >= MAX_CONSECUTIVE_REJECTIONS
        )

    def should_auto_approve(self, project: "Project") -> bool:
        return project.auto_approve and self.origin != "automatic" and self.status == "pending"

    def mark_applied(self) -> None:
        self.apply_failed = False
        self.apply_error = None

    def mark_apply_failed(self, error: str) -> None:
        self.apply_failed = True
        self.apply_error = error

    def _resolve(self, status: ProposalStatus) -> None:
        if self.status != "pending":
            raise ProposalAlreadyResolved(self.id, self.status)
        self.status = status
        self.resolved_at = _now()


def _order(proposal: Proposal) -> tuple[datetime, int]:
    return (proposal.created_at, proposal.id or 0)


def consecutive_rejections(history: Sequence[Proposal]) -> int:
    """Rejections in a row of one subject, from the newest proposal back to the last
    approved/adjusted one. Discarded proposals neither count nor stop the count.
    Shared with spec 002 (AdvancePlanning) so both agree on when a stage is capped."""
    count = 0
    for proposal in sorted(history, key=_order, reverse=True):
        if proposal.status == "rejected":
            count += 1
        elif proposal.decided:
            break
    return count
