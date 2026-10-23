"""Discard an expense draft; confirmed expenses are never deleted (spec 017, US2). Owner: P3."""

from app.application.ports.unit_of_work import UnitOfWork
from app.domain.transparency import ExpenseNotDraft, ExpenseNotFound


class DiscardExpense:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def execute(self, project_id: int, expense_id: int) -> None:
        expense = self._uow.expenses.get(expense_id)
        if expense is None or expense.project_id != project_id:
            raise ExpenseNotFound(expense_id)
        if expense.status != "draft":
            raise ExpenseNotDraft(expense_id)
        self._uow.expenses.delete(expense_id)
        self._uow.commit()
