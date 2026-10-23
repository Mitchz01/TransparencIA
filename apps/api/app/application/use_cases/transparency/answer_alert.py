"""The executing entity answers an alert publicly; it can't clear it (spec 017, US5, D12). Owner: P3."""

from app.application.ports.unit_of_work import UnitOfWork
from app.domain.transparency import Alert


class AnswerAlert:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def execute(self, project_id: int, alert_id: int, answer: str) -> Alert:
        raise NotImplementedError
