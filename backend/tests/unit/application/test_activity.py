import asyncio

import pytest

from app.adapters.outbound.events.in_memory_bus import InMemoryEventBus
from app.application.use_cases.activity.list_activity import FollowActivity, ListActivity
from app.domain.errors import ProjectNotFound, ValidationFailed
from app.domain.events import DomainEvent
from tests.fakes import InMemoryUnitOfWork, project


def _uow_with_events(n: int, project_id: int = 1) -> InMemoryUnitOfWork:
    uow = InMemoryUnitOfWork()
    uow.__enter__()
    for i in range(n):
        uow.activity.add(DomainEvent(type="note", project_id=project_id, summary=f"event {i}"))
    uow.commit()
    return uow


async def _take(stream, count: int) -> list[DomainEvent]:
    items = []
    async for event in stream:
        items.append(event)
        if len(items) == count:
            break
    return items


def test_replay_then_live_without_duplicates():
    async def scenario():
        uow = _uow_with_events(3)
        bus = InMemoryEventBus()
        stream = FollowActivity(uow.factory(), bus).stream(1, after=1)
        first = await stream.__anext__()  # subscribes, then replays seq 2 and 3
        # A live copy of an already replayed event, then a new one; one from another project.
        await bus.publish(DomainEvent(type="note", project_id=1, seq=3))
        await bus.publish(DomainEvent(type="note", project_id=2, seq=10))
        await bus.publish(DomainEvent(type="live", project_id=1, seq=4))
        rest = await _take(stream, 2)
        await stream.aclose()
        return [first, *rest]

    events = asyncio.run(scenario())
    assert [(e.seq, e.type) for e in events] == [(2, "note"), (3, "note"), (4, "live")]


def test_too_many_missed_sends_resync():
    async def scenario():
        uow = _uow_with_events(205)
        bus = InMemoryEventBus()
        stream = FollowActivity(uow.factory(), bus).stream(1, after=1)
        first = await stream.__anext__()
        await bus.publish(DomainEvent(type="old", project_id=1, seq=150))  # covered by the refetch
        await bus.publish(DomainEvent(type="new", project_id=1, seq=206))
        second = await stream.__anext__()
        await stream.aclose()
        return first, second

    first, second = asyncio.run(scenario())
    assert first.type == "resync" and second.type == "new"


def test_first_connection_without_after_is_live_only():
    async def scenario():
        uow = _uow_with_events(3)
        bus = InMemoryEventBus()
        stream = FollowActivity(uow.factory(), bus).stream(1, after=None)
        task = asyncio.ensure_future(stream.__anext__())
        await asyncio.sleep(0)
        await bus.publish(DomainEvent(type="live", project_id=1, seq=4))
        event = await task
        await stream.aclose()
        return event

    assert asyncio.run(scenario()).type == "live"


def test_history_newest_first_with_paging():
    uow = InMemoryUnitOfWork()
    saved = uow.projects.add(project())
    for i in range(5):
        uow.activity.add(DomainEvent(type="note", project_id=saved.id, summary=str(i)))
    uow.commit()

    page = ListActivity(uow).execute(saved.id, limit=2)
    assert [e.summary for e in page] == ["4", "3"]
    older = ListActivity(uow).execute(saved.id, before=page[-1].seq, limit=2)
    assert [e.summary for e in older] == ["2", "1"]
    with pytest.raises(ValidationFailed):
        ListActivity(uow).execute(saved.id, limit=0)
    with pytest.raises(ProjectNotFound):
        ListActivity(uow).execute(99)
