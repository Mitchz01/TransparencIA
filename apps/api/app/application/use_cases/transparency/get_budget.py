"""Read a project's budget (spec 017, US1). Owner: P3."""

from app.application.ports.unit_of_work import UnitOfWork
from app.domain.transparency import Budget


class GetBudget:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def execute(self, project_id: int) -> Budget | None:
        return self._uow.budgets.get(project_id)
