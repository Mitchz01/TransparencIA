import asyncio
from collections import defaultdict
from collections.abc import AsyncIterator

from app.domain.events import DomainEvent


class InMemoryEventBus:
    """One queue per subscriber and per project. Enough for a single process (monolith)."""

    def __init__(self) -> None:
        self._queues: dict[int, set[asyncio.Queue[DomainEvent]]] = defaultdict(set)

    async def publish(self, event: DomainEvent) -> None:
        if event.project_id is None:
            return
        for queue in self._queues[event.project_id]:
            queue.put_nowait(event)

    async def subscribe(self, project_id: int) -> AsyncIterator[DomainEvent]:
        queue: asyncio.Queue[DomainEvent] = asyncio.Queue()
        self._queues[project_id].add(queue)
        try:
            while True:
                yield await queue.get()
        finally:
            self._queues[project_id].discard(queue)
