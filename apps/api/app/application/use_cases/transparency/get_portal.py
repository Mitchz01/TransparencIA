"""Assemble the portal from the rules of domain/transparency.py (spec 017, US3). Owner: P3."""

import datetime as dt
from collections.abc import Callable

from app.application.ports.unit_of_work import UnitOfWork
from app.domain.transparency import Portal, TeamPortal


class GetPortal:
    def __init__(self, uow: UnitOfWork, public_app_url: str, today: Callable[[], dt.date]):
        self._uow = uow
        self._public_app_url = public_app_url
        self._today = today

    def for_team(self, project_id: int) -> TeamPortal:
        raise NotImplementedError

    def for_public(self, slug: str) -> Portal:
        """Raises ProjectNotFound for an unknown or unpublished slug."""
        raise NotImplementedError
