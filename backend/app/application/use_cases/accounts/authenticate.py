"""Who is calling (spec 015, FR-004): the account of a valid session token."""

from app.application.ports.unit_of_work import UnitOfWork
from app.application.use_cases.accounts.sessions import Clock, utc_now
from app.domain.accounts import Account, token_digest
from app.domain.errors import NotAuthenticated


class Authenticate:
    def __init__(self, uow: UnitOfWork, clock: Clock = utc_now):
        self._uow = uow
        self._clock = clock

    def execute(self, token: str | None) -> Account:
        session = self._uow.sessions.get_by_digest(token_digest(token)) if token else None
        if session is None:
            raise NotAuthenticated()
        if session.expired(self._clock()):
            self._uow.sessions.delete(session.id or 0)
            self._uow.commit()
            raise NotAuthenticated()
        account = self._uow.accounts.get(session.account_id)
        if account is None:
            raise NotAuthenticated()
        return account

    def optional(self, token: str | None) -> Account | None:
        """For the endpoints that also work signed out (the invitation preview)."""
        try:
            return self.execute(token)
        except NotAuthenticated:
            return None
