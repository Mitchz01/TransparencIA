"""Apply a decided proposal by calling the step its owner spec registered (spec 005, US2).

Deciding and applying are separate: the decision is saved in the request, and this runs
right after in the background with its own UnitOfWork. If applying fails, the proposal is
flagged `apply_failed`, ProposalApplyFailed is published, and the leader can retry."""

from collections.abc import Awaitable, Callable, Iterable
from typing import Protocol

from app.application.ports.event_bus import EventBus
from app.application.ports.unit_of_work import UnitOfWorkFactory
from app.domain.errors import NoApplierForProposal, ProposalNotFound, ProposalNotRetryable
from app.domain.events import EventRef, ProposalApplyFailed
from app.domain.proposals import Proposal

# Takes the proposal id and opens its own UnitOfWork, like the owner specs' use cases
# (AdvancePlanning.on_proposal_resolved, ApplyDocumentProposal, PublishIssues, ApplyReview, ApplyReplan).
Applier = Callable[[int], Awaitable[None]]
Resolution = str  # "decided" (approved or adjusted) or "rejected"


class ProposalAppliers(Protocol):
    def for_proposal(self, proposal: Proposal) -> Applier | None: ...


class ApplierRegistry:
    """Built in the composition root: each spec registers the step for its kind
    (and optionally a key), for decided and/or rejected proposals."""

    def __init__(self) -> None:
        self._appliers: dict[tuple[str, str | None, Resolution], Applier] = {}

    def register(self, kind: str, applier: Applier, *, key: str | None = None, on: Iterable[Resolution] = ("decided",)) -> None:
        for resolution in on:
            self._appliers[(kind, key, resolution)] = applier

    def for_proposal(self, proposal: Proposal) -> Applier | None:
        resolution = "decided" if proposal.decided else "rejected" if proposal.status == "rejected" else None
        if resolution is None:
            return None
        return self._appliers.get((proposal.kind, proposal.key, resolution)) or self._appliers.get(
            (proposal.kind, None, resolution)
        )


class ApplyProposal:
    def __init__(self, uow_factory: UnitOfWorkFactory, bus: EventBus, appliers: ProposalAppliers):
        self._uow_factory = uow_factory
        self._bus = bus
        self._appliers = appliers

    async def execute(self, proposal_id: int) -> None:
        with self._uow_factory() as uow:
            proposal = uow.proposals.get(proposal_id)
        if proposal is None:
            return
        applier = self._appliers.for_proposal(proposal)
        if applier is None:
            if proposal.decided:  # a rejection without a follow-up is fine; a decision isn't
                await self._fail(proposal_id, str(NoApplierForProposal(proposal.kind, proposal.key)))
            return
        try:
            await applier(proposal_id)
        except Exception as error:  # noqa: BLE001  any failure is reported, never swallowed
            await self._fail(proposal_id, str(error) or error.__class__.__name__)
            return
        if proposal.apply_failed:
            with self._uow_factory() as uow:
                current = uow.proposals.get(proposal_id)
                if current is not None:
                    current.mark_applied()
                    uow.proposals.save(current)
                    uow.commit()

    async def _fail(self, proposal_id: int, error: str) -> None:
        with self._uow_factory() as uow:
            proposal = uow.proposals.get(proposal_id)
            if proposal is None:
                return
            proposal.mark_apply_failed(error)
            uow.proposals.save(proposal)
            uow.commit()
        await self._bus.publish(
            ProposalApplyFailed(
                project_id=proposal.project_id,
                proposal_id=proposal_id,
                error=error,
                summary=f"The {proposal.key} proposal couldn't be applied: {error}",
                ref=EventRef(kind="proposal", id=proposal_id),
            )
        )


class RetryApply:
    """Checks a failed application can be retried; the caller then runs ApplyProposal."""

    def __init__(self, uow_factory: UnitOfWorkFactory):
        self._uow_factory = uow_factory

    def execute(self, proposal_id: int) -> Proposal:
        with self._uow_factory() as uow:
            proposal = uow.proposals.get(proposal_id)
        if proposal is None:
            raise ProposalNotFound(proposal_id)
        if not (proposal.decided and proposal.apply_failed):
            raise ProposalNotRetryable(proposal_id)
        return proposal
