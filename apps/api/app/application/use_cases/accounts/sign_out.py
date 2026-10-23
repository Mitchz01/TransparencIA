"""UC-15 · Sign out: ends this device's session (spec 015, US1). Idempotent."""

from app.application.ports.unit_of_work import UnitOfWork
from app.domain.accounts import token_digest


class SignOut:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def execute(self, token: str | None) -> None:
        session = self._uow.sessions.get_by_digest(token_digest(token)) if token else None
        if session is not None and session.id is not None:
            self._uow.sessions.delete(session.id)
            self._uow.commit()
