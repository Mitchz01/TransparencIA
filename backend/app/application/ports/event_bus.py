from collections.abc import AsyncIterator
from typing import Protocol

from app.domain.events import DomainEvent


class EventBus(Protocol):
    async def publish(self, event: DomainEvent) -> None: ...

    def subscribe(self, project_id: int) -> AsyncIterator[DomainEvent]:
        """A project's events from the moment of subscribing (for SSE)."""
        ...
