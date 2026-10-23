from collections.abc import AsyncIterator
from typing import Protocol

from app.domain.events import DomainEvent


class EventBus(Protocol):
    async def publish(self, event: DomainEvent) -> None: ...

    def subscribe(self, project_id: int) -> AsyncIterator[DomainEvent]:
        """Eventos de un proyecto desde que se suscribe (para SSE)."""
        ...
