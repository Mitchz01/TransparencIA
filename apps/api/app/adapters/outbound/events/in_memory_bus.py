import asyncio
from collections import defaultdict

from app.domain.events import DomainEvent


class Subscription:
    """Registered as soon as it's created, so nothing published after subscribe() is lost
    (the SSE endpoint subscribes before replaying the history, spec 005)."""

    def __init__(self, bus: "InMemoryEventBus", project_id: int):
        self._bus = bus
        self._project_id = project_id
        self._queue: asyncio.Queue[DomainEvent] = asyncio.Queue()
        bus._queues[project_id].add(self._queue)

    def __aiter__(self) -> "Subscription":
        return self

    async def __anext__(self) -> DomainEvent:
        return await self._queue.get()

    async def aclose(self) -> None:
        self._bus._queues[self._project_id].discard(self._queue)


class InMemoryEventBus:
    """One queue per subscriber and per project. Enough for a single process (monolith)."""

    def __init__(self) -> None:
        self._queues: dict[int, set[asyncio.Queue[DomainEvent]]] = defaultdict(set)

    async def publish(self, event: DomainEvent) -> None:
        if event.project_id is None:
            return
        for queue in list(self._queues[event.project_id]):
            queue.put_nowait(event)

    def subscribe(self, project_id: int) -> Subscription:
        return Subscription(self, project_id)
