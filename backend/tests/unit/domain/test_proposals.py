from datetime import datetime, timedelta, timezone

import pytest

from app.domain.errors import ProposalAlreadyResolved, ValidationFailed
from app.domain.project import Project
from app.domain.proposals import Proposal, consecutive_rejections

T0 = datetime(2026, 10, 23, 12, tzinfo=timezone.utc)


def _proposal(**overrides) -> Proposal:
    data = {"project_id": 1, "kind": "plan_stage", "key": "methodology", "agent": "Agile coach", "content": {"m": "scrum"}}
    return Proposal(**{**data, **overrides})


def _history(*statuses: str, key: str = "roadmap") -> list[Proposal]:
    return [
        _proposal(id=i, key=key, status=s, created_at=T0 + timedelta(minutes=i)) for i, s in enumerate(statuses, start=1)
    ]


def test_approve_keeps_original_content():
    proposal = _proposal()
    proposal.approve(auto=True)
    assert proposal.status == "approved"
    assert proposal.auto_approved
    assert proposal.final_content == {"m": "scrum"}
    assert proposal.resolved_at is not None


def test_adjust_replaces_final_content():
    proposal = _proposal()
    proposal.adjust({"m": "kanban"})
    assert proposal.status == "adjusted"
    assert proposal.final_content == {"m": "kanban"}


def test_cannot_resolve_twice():
    proposal = _proposal()
    proposal.reject("Not now")
    with pytest.raises(ProposalAlreadyResolved):
        proposal.approve()
    with pytest.raises(ProposalAlreadyResolved):
        proposal.discard()


def test_reject_requires_a_reason():
    proposal = _proposal()
    with pytest.raises(ValidationFailed) as info:
        proposal.reject("   ")
    assert info.value.errors[0].field == "reason" and proposal.status == "pending"
    with pytest.raises(ValidationFailed):
        proposal.reject("x" * 1001)
    proposal.reject("  It's 4 weeks, not 8 ")
    assert proposal.rejection_reason == "It's 4 weeks, not 8"


def test_discard_only_from_pending():
    proposal = _proposal()
    proposal.discard()
    assert proposal.status == "discarded" and not proposal.decided


def test_consecutive_rejections():
    assert consecutive_rejections(_history("rejected", "rejected")) == 2
    assert consecutive_rejections(_history("rejected", "approved", "rejected")) == 1
    # discarded neither counts nor stops the count
    assert consecutive_rejections(_history("rejected", "discarded", "rejected", "rejected")) == 3
    assert consecutive_rejections(_history("adjusted")) == 0


def test_adjust_after_limit_only_on_the_newest_capped_rejection():
    capped = _history("rejected", "rejected", "rejected")
    newest = capped[-1]
    newest.adjust_after_limit({"m": "mine"}, capped)
    assert newest.status == "adjusted" and newest.final_content == {"m": "mine"}

    older = _history("rejected", "rejected", "rejected")
    with pytest.raises(ProposalAlreadyResolved):
        older[0].adjust_after_limit({"m": "mine"}, older)

    not_capped = _history("rejected", "rejected")
    with pytest.raises(ProposalAlreadyResolved):
        not_capped[-1].adjust_after_limit({"m": "mine"}, not_capped)


def test_should_auto_approve():
    on = Project(name="P", description="D", auto_approve=True)
    off = Project(name="P", description="D")
    assert _proposal().should_auto_approve(on)
    assert not _proposal().should_auto_approve(off)
    assert not _proposal(origin="automatic").should_auto_approve(on)


def test_apply_flags():
    proposal = _proposal()
    proposal.approve()
    proposal.mark_apply_failed("boom")
    assert proposal.apply_failed and proposal.apply_error == "boom"
    proposal.mark_applied()
    assert not proposal.apply_failed and proposal.apply_error is None
