"""Discard an expense draft; confirmed ones can't be deleted (spec 017, US2). Owner: P3."""

from app.application.ports.unit_of_work import UnitOfWork


class DiscardExpense:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def execute(self, project_id: int, expense_id: int) -> None:
        raise NotImplementedError
