"""Session tokens (spec 015): random, sent once in the cookie, stored only as a digest."""

import secrets
from collections.abc import Callable
from datetime import datetime, timezone

from app.application.ports.unit_of_work import UnitOfWork, UnitOfWorkFactory
from app.domain.accounts import new_session, token_digest

Clock = Callable[[], datetime]


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def open_session(uow: UnitOfWork, account_id: int, now: datetime) -> str:
    """Saves a new session (the caller commits) and returns its token."""
    token = secrets.token_urlsafe(32)
    uow.sessions.add(new_session(account_id, token_digest(token), now))
    return token


class PruneSessions:
    """At startup: deletes expired sessions."""

    def __init__(self, uow_factory: UnitOfWorkFactory, clock: Clock = utc_now):
        self._uow_factory = uow_factory
        self._clock = clock

    def execute(self) -> int:
        with self._uow_factory() as uow:
            pruned = uow.sessions.prune_expired(self._clock())
            uow.commit()
            return pruned
