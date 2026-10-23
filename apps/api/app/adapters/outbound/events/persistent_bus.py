"""Saves every event as the project's activity before fanning it out (spec 005):
the saved row's id becomes the event's `seq`, the history endpoint reads the same rows,
and events are kept even when nobody is connected."""

from app.adapters.outbound.events.in_memory_bus import InMemoryEventBus, Subscription
from app.application.ports.unit_of_work import UnitOfWorkFactory
from app.domain.events import DomainEvent


class PersistentEventBus:
    def __init__(self, inner: InMemoryEventBus, uow_factory: UnitOfWorkFactory):
        self._inner = inner
        self._uow_factory = uow_factory

    async def publish(self, event: DomainEvent) -> None:
        if event.project_id is None:
            await self._inner.publish(event)
            return
        with self._uow_factory() as uow:
            saved = uow.activity.add(event)
            uow.commit()
        # The subclass instance keeps its type; only seq comes from the saved row.
        await self._inner.publish(event.model_copy(update={"seq": saved.seq}))

    def subscribe(self, project_id: int) -> Subscription:
        return self._inner.subscribe(project_id)
