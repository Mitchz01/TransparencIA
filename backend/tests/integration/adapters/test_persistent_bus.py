import asyncio

from sqlmodel import Session, SQLModel, create_engine

from app.adapters.outbound.events.in_memory_bus import InMemoryEventBus
from app.adapters.outbound.events.persistent_bus import PersistentEventBus
from app.adapters.outbound.persistence import tables  # noqa: F401
from app.adapters.outbound.persistence.unit_of_work import SqlUnitOfWork
from app.domain.events import ProposalResolved, TeamChanged


def test_events_are_saved_with_increasing_seq_and_fanned_out_per_project(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path}/bus.db")
    SQLModel.metadata.create_all(engine)

    def factory():
        return SqlUnitOfWork(Session(engine), owns_session=True)

    async def scenario():
        bus = PersistentEventBus(InMemoryEventBus(), factory)
        mine, other = bus.subscribe(1), bus.subscribe(2)
        await bus.publish(ProposalResolved(project_id=1, proposal_id=5, status="approved", summary="Approved"))
        await bus.publish(TeamChanged(project_id=1, joined=["Sofía"], left=[], changed=[]))
        received = [await mine.__anext__(), await mine.__anext__()]
        await mine.aclose()
        await other.aclose()
        return received, other

    received, other = asyncio.run(scenario())
    assert [e.type for e in received] == ["proposal_resolved", "team_changed"]
    assert received[0].seq < received[1].seq
    assert isinstance(received[1], TeamChanged)  # subscribers get the real event type
    assert other._queue.empty()

    with factory() as uow:
        history = uow.activity.list_recent(1, None, 10)
    assert [e.type for e in history] == ["team_changed", "proposal_resolved"]
    assert history[0].model_dump()["joined"] == ["Sofía"]  # type-specific fields are kept
    assert history[1].occurred_at.tzinfo is not None
