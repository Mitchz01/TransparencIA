"""Keep the sync bookkeeping small (spec 008, T028): on startup, deliveries and consumed own
writes older than SYNC_RECORDS_TTL_DAYS are deleted. GitHub doesn't redeliver that late, and an
unconsumed own write is kept: its echo may still come."""

from datetime import datetime, timedelta, timezone

from app.application.ports.unit_of_work import UnitOfWorkFactory
from app.domain.sync import SYNC_RECORDS_TTL_DAYS


class PruneSyncRecords:
    def __init__(self, uow_factory: UnitOfWorkFactory):
        self._uow_factory = uow_factory

    def execute(self, now: datetime | None = None) -> tuple[int, int]:
        """(deliveries, own writes) deleted."""
        before = (now or datetime.now(timezone.utc)) - timedelta(days=SYNC_RECORDS_TTL_DAYS)
        with self._uow_factory() as uow:
            deliveries = uow.deliveries.prune(before)
            writes = uow.own_writes.prune_consumed(before)
            uow.commit()
        return deliveries, writes
