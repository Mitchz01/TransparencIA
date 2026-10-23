"""Approve several proposals of a project in one request, each on its own (spec 005, US7)."""

from app.application.dto import BulkResult
from app.application.ports.event_bus import EventBus
from app.application.ports.unit_of_work import UnitOfWorkFactory
from app.application.use_cases.proposals.resolve_proposal import ApproveProposal
from app.domain.errors import DomainError, ProjectNotFound, ProposalNotFound, ValidationFailed

MAX_IDS = 100


class ApproveProposals:
    def __init__(self, uow_factory: UnitOfWorkFactory, bus: EventBus):
        self._uow_factory = uow_factory
        self._bus = bus

    async def execute(self, project_id: int, ids: list[int]) -> list[BulkResult]:
        if not ids:
            raise ValidationFailed.single("ids", "At least one id is required.")
        if len(ids) > MAX_IDS:
            raise ValidationFailed.single("ids", f"Max {MAX_IDS} ids.")
        with self._uow_factory() as uow:
            if uow.projects.get(project_id) is None:
                raise ProjectNotFound(project_id)

        results: list[BulkResult] = []
        for proposal_id in ids:
            # One transaction per proposal: one failing doesn't stop the others.
            with self._uow_factory() as uow:
                try:
                    proposal = uow.proposals.get(proposal_id)
                    if proposal is None or proposal.project_id != project_id:
                        raise ProposalNotFound(proposal_id)
                    await ApproveProposal(uow, self._bus).execute(proposal_id)
                    results.append(BulkResult(id=proposal_id, ok=True))
                except DomainError as error:
                    results.append(BulkResult(id=proposal_id, ok=False, error={"code": error.code, "detail": error.detail, **error.extra()}))
        return results
