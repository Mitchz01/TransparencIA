"""The project's activity: history (spec 005, US6) and live stream with replay (US3)."""

from collections.abc import AsyncIterator

from app.application.ports.event_bus import EventBus
from app.application.ports.unit_of_work import UnitOfWork, UnitOfWorkFactory
from app.domain.errors import FieldError, ProjectNotFound, ValidationFailed
from app.domain.events import DomainEvent, Resync

DEFAULT_LIMIT = 50
MAX_LIMIT = 200
REPLAY_LIMIT = 200


class ListActivity:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def execute(self, project_id: int, before: int | None = None, limit: int = DEFAULT_LIMIT) -> list[DomainEvent]:
        errors: list[FieldError] = []
        if not 1 <= limit <= MAX_LIMIT:
            errors.append(FieldError("limit", f"Must be between 1 and {MAX_LIMIT}."))
        if before is not None and before < 1:
            errors.append(FieldError("before", "Must be a positive integer."))
        if errors:
            raise ValidationFailed(errors)
        if self._uow.projects.get(project_id) is None:
            raise ProjectNotFound(project_id)
        return self._uow.activity.list_recent(project_id, before, limit)


class FollowActivity:
    """Replays what a reconnecting client missed, then follows live without duplicates.
    Pure async logic: the SSE adapter only formats what this yields."""

    def __init__(self, uow_factory: UnitOfWorkFactory, bus: EventBus):
        self._uow_factory = uow_factory
        self._bus = bus

    async def stream(self, project_id: int, after: int | None) -> AsyncIterator[DomainEvent]:
        # Subscribe before reading the history, so nothing published in between is lost.
        subscription = self._bus.subscribe(project_id)
        last = 0
        try:
            if after is not None:
                last = after
                with self._uow_factory() as uow:
                    missed = uow.activity.list_after(project_id, after, REPLAY_LIMIT + 1)
                    newest = uow.activity.list_recent(project_id, None, 1)
                if len(missed) > REPLAY_LIMIT:
                    yield Resync(project_id=project_id, summary="Too many events missed: reload the project.")
                    # Live events up to the newest saved one are covered by the client's refetch.
                    if newest and newest[0].seq is not None:
                        last = newest[0].seq
                else:
                    for event in missed:
                        last = event.seq or last
                        yield event
            async for event in subscription:
                if event.seq is not None and event.seq <= last:
                    continue  # already sent during the replay
                last = event.seq or last
                yield event
        finally:
            await subscription.aclose()
