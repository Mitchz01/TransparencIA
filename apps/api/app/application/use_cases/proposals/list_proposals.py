"""See what the agents proposed and why (spec 005, US1)."""

from app.application.ports.unit_of_work import UnitOfWork
from app.domain.errors import ProjectNotFound, ProposalNotFound
from app.domain.proposals import Proposal, ProposalStatus


class ListProposals:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def execute(self, project_id: int, status: ProposalStatus | None = None) -> list[Proposal]:
        if self._uow.projects.get(project_id) is None:
            raise ProjectNotFound(project_id)
        proposals = self._uow.proposals.list_by_project(project_id)  # newest first
        return [p for p in proposals if status is None or p.status == status]


class GetProposal:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def execute(self, proposal_id: int) -> Proposal:
        proposal = self._uow.proposals.get(proposal_id)
        if proposal is None:
            raise ProposalNotFound(proposal_id)
        return proposal
