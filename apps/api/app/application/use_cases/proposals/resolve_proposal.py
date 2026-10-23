"""Decide on a proposal: approve, adjust or reject (spec 005, US2 and US4).

The decision is saved in the request's UnitOfWork and published as ProposalResolved;
applying it (ApplyProposal) runs afterwards, so deciding never waits for an agent."""

from typing import Any

from app.application.ports.event_bus import EventBus
from app.application.ports.unit_of_work import UnitOfWork
from app.domain.errors import ProposalAlreadyResolved, ProposalNotFound
from app.domain.events import Actor, EventRef, ProposalResolved
from app.domain.proposal_schemas import validate_content
from app.domain.proposals import Proposal, ProposalStatus

_VERBS = {"approved": "Approved", "adjusted": "Adjusted", "rejected": "Rejected", "discarded": "Discarded"}


def resolved_event(proposal: Proposal, *, actor: Actor = "person") -> ProposalResolved:
    verb = _VERBS.get(proposal.status, proposal.status)
    how = " automatically" if proposal.auto_approved else ""
    return ProposalResolved(
        project_id=proposal.project_id,
        actor=actor,
        summary=f"{verb}{how} the {proposal.key} proposal from {proposal.agent}",
        ref=EventRef(kind="proposal", id=proposal.id or 0),
        proposal_id=proposal.id or 0,
        kind=proposal.kind,
        key=proposal.key,
        status=proposal.status,
        auto=proposal.auto_approved,
        reason=proposal.rejection_reason,
    )


class _Decide:
    def __init__(self, uow: UnitOfWork, bus: EventBus):
        self._uow = uow
        self._bus = bus

    def _load(self, proposal_id: int) -> Proposal:
        proposal = self._uow.proposals.get(proposal_id)
        if proposal is None:
            raise ProposalNotFound(proposal_id)
        return proposal

    async def _save(self, proposal: Proposal, previous: ProposalStatus) -> Proposal:
        saved = self._uow.proposals.save_if_status(proposal, previous)
        self._uow.commit()
        await self._bus.publish(resolved_event(saved))
        return saved


class ApproveProposal(_Decide):
    async def execute(self, proposal_id: int) -> Proposal:
        proposal = self._load(proposal_id)
        previous = proposal.status
        proposal.approve()
        return await self._save(proposal, previous)


class AdjustProposal(_Decide):
    async def execute(self, proposal_id: int, content: dict[str, Any]) -> Proposal:
        proposal = self._load(proposal_id)
        previous = proposal.status
        if proposal.status == "pending":
            proposal.adjust(validate_content(proposal.kind, proposal.key, content))
        elif proposal.status == "rejected":
            # The leader writes their own version of a capped stage (spec 002 FR-011).
            history = [p for p in self._uow.proposals.list_by_project(proposal.project_id) if p.subject == proposal.subject]
            if not proposal.can_adjust_after_limit(history):
                raise ProposalAlreadyResolved(proposal.id, proposal.status)
            proposal.adjust_after_limit(validate_content(proposal.kind, proposal.key, content), history)
        else:
            raise ProposalAlreadyResolved(proposal.id, proposal.status)
        return await self._save(proposal, previous)


class RejectProposal(_Decide):
    async def execute(self, proposal_id: int, reason: str) -> Proposal:
        proposal = self._load(proposal_id)
        previous = proposal.status
        proposal.reject(reason)
        return await self._save(proposal, previous)
