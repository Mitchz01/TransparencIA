import pytest

from app.domain.errors import ProposalAlreadyResolved
from app.domain.proposals import Proposal


def _proposal() -> Proposal:
    return Proposal(project_id=1, kind="plan_stage", key="methodology", agent="Agile coach", content={"m": "scrum"})


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
