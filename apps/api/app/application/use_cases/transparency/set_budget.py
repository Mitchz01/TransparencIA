"""Set a project's budget, leaders only (spec 017, US1). Owner: P3."""

from app.application.ports.unit_of_work import UnitOfWork
from app.domain.transparency import Budget


class SetBudget:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def execute(self, project_id: int, budget: Budget) -> Budget:
        raise NotImplementedError
