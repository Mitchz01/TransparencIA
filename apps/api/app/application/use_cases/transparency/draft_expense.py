"""Read an uploaded piece of evidence into an expense draft with the AI's alerts (spec 017, US2).
The file and the draft are only saved if the agent succeeds. Owner: P3."""

from app.application.ports.transparency_agents import TransparencyAgents
from app.application.ports.unit_of_work import UnitOfWork
from app.domain.transparency import Expense


class DraftExpense:
    def __init__(self, uow: UnitOfWork, agents: TransparencyAgents):
        self._uow = uow
        self._agents = agents

    async def execute(self, project_id: int, filename: str, mime: str, data: bytes) -> Expense:
        raise NotImplementedError
