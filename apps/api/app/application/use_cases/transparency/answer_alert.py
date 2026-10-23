"""The executing entity answers an alert in public; the alert itself stays (spec 017, US5, D12). Owner: P3."""

import datetime as dt

from app.application.ports.unit_of_work import UnitOfWork
from app.domain.errors import FieldError, ValidationFailed
from app.domain.transparency import ANSWER_MAX, Alert, AlertNotFound


class AnswerAlert:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def execute(self, project_id: int, alert_id: int, answer: str) -> Alert:
        alert = self._uow.expenses.get_alert(alert_id)
        expense = self._uow.expenses.get(alert.expense_id) if alert and alert.expense_id is not None else None
        # Alerts of drafts aren't public yet, so there is nothing to answer.
        if alert is None or expense is None or expense.project_id != project_id or expense.status != "confirmed":
            raise AlertNotFound(alert_id)
        text = answer.strip()
        if not text:
            raise ValidationFailed([FieldError("answer", "Required.")])
        if len(text) > ANSWER_MAX:
            raise ValidationFailed([FieldError("answer", f"Max {ANSWER_MAX} characters.")])
        saved = self._uow.expenses.save_alert(
            alert.model_copy(update={"answer": text, "answered_at": dt.datetime.now(dt.timezone.utc)})
        )
        self._uow.commit()
        return saved
