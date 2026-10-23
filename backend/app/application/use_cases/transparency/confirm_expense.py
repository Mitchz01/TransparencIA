"""Confirm an expense draft: the person's fields, plus the rule alerts (spec 017, US2, FR-005). Owner: P1."""

import datetime as dt
from collections.abc import Callable

from app.application.ports.unit_of_work import UnitOfWork
from app.domain.transparency import Expense, ExpenseConfirmation


class ConfirmExpense:
    def __init__(self, uow: UnitOfWork, today: Callable[[], dt.date]):
        self._uow = uow
        self._today = today

    def execute(self, project_id: int, expense_id: int, confirmation: ExpenseConfirmation) -> Expense:
        raise NotImplementedError
