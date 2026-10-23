from collections.abc import AsyncIterator
from typing import Protocol

from app.domain.events import DomainEvent


class EventSubscription(AsyncIterator[DomainEvent], Protocol):
    async def aclose(self) -> None: ...


class EventBus(Protocol):
    async def publish(self, event: DomainEvent) -> None:
        """Publishes the event. The real bus also saves it as activity and sets its `seq`."""
        ...

    def subscribe(self, project_id: int) -> EventSubscription:
        """A project's events from the moment this is called (not from the first read)."""
        ...
