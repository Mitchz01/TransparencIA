"""One auto-approve rule for every proposal creator (spec 005, US5).

Specs 002, 006, 007 and 008 call `after_created(proposal_id)` right after saving a new
proposal: if the project has auto-approve on and the proposal wasn't raised by the system
on its own (origin "automatic", spec 008 FR-016), it's approved and applied."""

from app.application.ports.event_bus import EventBus
from app.application.ports.unit_of_work import UnitOfWorkFactory
from app.application.use_cases.proposals.apply_proposal import ApplyProposal
from app.application.use_cases.proposals.resolve_proposal import resolved_event


class AutoApprove:
    def __init__(self, uow_factory: UnitOfWorkFactory, bus: EventBus, apply: ApplyProposal):
        self._uow_factory = uow_factory
        self._bus = bus
        self._apply = apply

    async def after_created(self, proposal_id: int) -> bool:
        """True if the proposal was auto-approved (and then applied)."""
        with self._uow_factory() as uow:
            proposal = uow.proposals.get(proposal_id)
            project = uow.projects.get(proposal.project_id) if proposal else None
            if proposal is None or project is None or not proposal.should_auto_approve(project):
                return False
            proposal.approve(auto=True)
            saved = uow.proposals.save_if_status(proposal, "pending")
            uow.commit()
        await self._bus.publish(resolved_event(saved, actor="system"))
        await self._apply.execute(proposal_id)
        return True
