"""Spec 008: webhook deliveries and the startup pruning (T028) on the real SQLite adapter."""

from datetime import datetime, timedelta, timezone

from sqlmodel import Session, SQLModel

from app.adapters.outbound.persistence.db import engine
from app.adapters.outbound.persistence.unit_of_work import SqlUnitOfWork
from app.application.use_cases.integrations.prune_sync_records import PruneSyncRecords
from app.domain.integrations import OwnWrite
from app.domain.sync import WebhookDelivery
from tests.fakes import InMemoryUnitOfWork

NOW = datetime(2026, 10, 23, 12, 0, tzinfo=timezone.utc)
OLD = NOW - timedelta(days=8)
RECENT = NOW - timedelta(days=2)


def _fresh_db() -> None:
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)


def _sql_uow() -> SqlUnitOfWork:
    return SqlUnitOfWork(Session(engine), owns_session=True)


def _seed(uow) -> None:
    with uow:
        uow.deliveries.add(WebhookDelivery(delivery_id="old", event="issues", received_at=OLD))
        uow.deliveries.add(WebhookDelivery(delivery_id="recent", event="issues", received_at=RECENT))
        uow.own_writes.add(OwnWrite(repository="a/b", number=1, action="issue_closed", created_at=OLD, consumed_at=OLD))
        uow.own_writes.add(OwnWrite(repository="a/b", number=2, action="issue_closed", created_at=OLD))  # never consumed
        uow.own_writes.add(OwnWrite(repository="a/b", number=3, action="issue_edited", created_at=OLD, consumed_at=RECENT))
        uow.commit()


def test_deliveries_are_remembered():
    _fresh_db()
    with _sql_uow() as uow:
        assert not uow.deliveries.seen("72d3")
        saved = uow.deliveries.add(WebhookDelivery(delivery_id="72d3", event="pull_request"))
        uow.commit()
    assert saved.id is not None
    with _sql_uow() as uow:
        assert uow.deliveries.seen("72d3") and not uow.deliveries.seen("other")


def test_pruning_deletes_old_deliveries_and_old_consumed_writes_only():
    _fresh_db()
    _seed(_sql_uow())
    assert PruneSyncRecords(_sql_uow).execute(NOW) == (1, 1)
    with _sql_uow() as uow:
        assert not uow.deliveries.seen("old") and uow.deliveries.seen("recent")
        # #2 wasn't consumed: its echo can still arrive
        assert uow.own_writes.consume_matching("a/b", 2, "issue_closed")
        assert not uow.own_writes.consume_matching("a/b", 1, "issue_closed")


def test_the_fakes_prune_the_same_way():
    uow = InMemoryUnitOfWork()
    _seed(uow)
    assert PruneSyncRecords(uow.factory()).execute(NOW) == (1, 1)
    with uow:
        assert [d.delivery_id for d in uow.deliveries.all()] == ["recent"]
        assert [w.number for w in uow.own_writes.all()] == [2, 3]
