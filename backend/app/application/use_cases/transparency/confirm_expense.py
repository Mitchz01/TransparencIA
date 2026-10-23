"""Confirm an expense draft: the person's fields, plus the rule alerts (spec 017, US2, FR-005). Owner: P1.
The AI's alerts stay even if the person changed what they were about: the portal shows that the AI
flagged it and what the person decided (D12)."""

from app.application.ports.unit_of_work import UnitOfWork
from app.domain.errors import ProjectNotFound, ValidationFailed
from app.domain.transparency import (
    Alert,
    BudgetMissing,
    Expense,
    ExpenseConfirmation,
    ExpenseNotDraft,
    ExpenseNotFound,
    confirmation_errors,
    end_date,
    rule_alerts,
)


class ConfirmExpense:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def execute(self, project_id: int, expense_id: int, confirmation: ExpenseConfirmation) -> Expense:
        project = self._uow.projects.get(project_id)
        if project is None:
            raise ProjectNotFound(project_id)
        expense = self._uow.expenses.get(expense_id)
        if expense is None or expense.project_id != project_id:
            raise ExpenseNotFound(expense_id)
        if expense.status != "draft":
            raise ExpenseNotDraft(expense_id)
        budget = self._uow.budgets.get(project_id)
        if budget is None:
            raise BudgetMissing(project_id)
        tasks = {t.id: t for t in self._uow.tasks.list_by_project(project_id) if t.id is not None}
        errors = confirmation_errors(confirmation, budget, set(tasks))
        if errors:
            raise ValidationFailed(errors)

        values = confirmation.model_dump()
        values["citizen_summary"] = confirmation.citizen_summary.strip()
        task = tasks.get(confirmation.task_id) if confirmation.task_id is not None else None
        confirmed = expense.model_copy(update={**values, "task_title": task.title if task else None, "status": "confirmed"})
        others = self._uow.expenses.list_by_project(project_id, "confirmed")
        new_alerts = rule_alerts(budget, end_date(budget, project.duration_weeks), others, confirmed)
        confirmed.alerts = [a for a in expense.alerts if a.source == "ai"] + [
            Alert(level=a.level, reason=a.reason, source="rule") for a in new_alerts
        ]
        saved = self._uow.expenses.save(confirmed)
        self._uow.commit()
        return saved
