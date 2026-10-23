"""In-memory test doubles for the application ports, shared by every spec's tests.
They copy entities in and out, like a database would, so tests can't rely on aliasing."""

from collections.abc import AsyncIterator, Callable
from datetime import datetime, timezone
from itertools import count
from typing import Any, Self

from app.adapters.outbound.code_host.fake import FakeCodeHost
from app.application.ports.code_host import OnRetry
from app.domain.board import Objective, Sprint, Task
from app.domain.documents import Document, DocumentVersion
from app.domain.errors import ProposalAlreadyResolved
from app.domain.events import DomainEvent
from app.domain.integrations import ExternalKind, ExternalLink, OwnWrite, OwnWriteAction
from app.domain.project import Member, Project
from app.domain.proposals import Proposal, ProposalStatus
from app.domain.sync import WebhookDelivery


class _Store:
    """Committed rows plus a working copy that commit() publishes and rollback() drops."""

    def __init__(self) -> None:
        self.committed: dict[str, dict[int, Any]] = {}
        self.ids = count(1)

    def table(self, name: str) -> dict[int, Any]:
        return self.committed.setdefault(name, {})


class _Repo:
    def __init__(self, uow: "InMemoryUnitOfWork", table: str):
        self._uow = uow
        self._table = table

    @property
    def rows(self) -> dict[int, Any]:
        return self._uow.working.setdefault(self._table, {})

    def _put(self, entity: Any) -> Any:
        if entity.id is None:
            entity = entity.model_copy(update={"id": next(self._uow.store.ids)})
        self.rows[entity.id] = entity.model_copy(deep=True)
        return entity.model_copy(deep=True)

    def get(self, id: int) -> Any:
        row = self.rows.get(id)
        return row.model_copy(deep=True) if row else None

    def add(self, entity: Any) -> Any:
        return self._put(entity)

    def save(self, entity: Any) -> Any:
        return self._put(entity)


class FakeProjectRepository(_Repo):
    def __init__(self, uow: "InMemoryUnitOfWork"):
        super().__init__(uow, "projects")

    def add(self, project: Project) -> Project:
        members = [m if m.id is not None else m.model_copy(update={"id": next(self._uow.store.ids)}) for m in project.members]
        return self._put(project.model_copy(update={"members": members}))

    def save(self, project: Project) -> Project:
        return self.add(project)

    def list(self) -> list[Project]:
        return [p.model_copy(deep=True) for _, p in sorted(self.rows.items())]

    def get_by_member(self, member_id: int) -> Project | None:
        return next((p for p in self.list() if any(m.id == member_id for m in p.members)), None)

    def get_by_repository(self, repository: str) -> Project | None:
        return next((p for p in self.list() if (p.repository or "").lower() == repository.lower()), None)


class FakeSprintRepository(_Repo):
    def __init__(self, uow: "InMemoryUnitOfWork"):
        super().__init__(uow, "sprints")

    def list_by_project(self, project_id: int) -> list[Sprint]:
        return sorted((s.model_copy(deep=True) for s in self.rows.values() if s.project_id == project_id), key=lambda s: s.number)


class FakeObjectiveRepository(_Repo):
    def __init__(self, uow: "InMemoryUnitOfWork"):
        super().__init__(uow, "objectives")

    def list_by_project(self, project_id: int) -> list[Objective]:
        return [o.model_copy(deep=True) for _, o in sorted(self.rows.items()) if o.project_id == project_id]


class FakeTaskRepository(_Repo):
    def __init__(self, uow: "InMemoryUnitOfWork"):
        super().__init__(uow, "tasks")

    def list_by_project(self, project_id: int) -> list[Task]:
        return sorted((t.model_copy(deep=True) for t in self.rows.values() if t.project_id == project_id), key=lambda t: t.position)

    def delete(self, task_id: int) -> None:
        self.rows.pop(task_id, None)


class FakeProposalRepository(_Repo):
    def __init__(self, uow: "InMemoryUnitOfWork"):
        super().__init__(uow, "proposals")

    def list_by_project(self, project_id: int) -> list[Proposal]:
        rows = [p.model_copy(deep=True) for p in self.rows.values() if p.project_id == project_id]
        return sorted(rows, key=lambda p: (p.created_at, p.id or 0), reverse=True)

    def save_if_status(self, proposal: Proposal, expected: ProposalStatus) -> Proposal:
        # Like UPDATE ... WHERE status = :expected: what another unit already committed counts.
        committed = self._uow.store.table("proposals").get(proposal.id)  # type: ignore[arg-type]
        current = committed if committed is not None else self.rows.get(proposal.id)  # type: ignore[arg-type]
        if current is None or current.status != expected:
            raise ProposalAlreadyResolved(proposal.id, current.status if current else "missing")
        return self._put(proposal)


class FakeActivityRepository(_Repo):
    def __init__(self, uow: "InMemoryUnitOfWork"):
        super().__init__(uow, "activity")

    def add(self, event: DomainEvent) -> DomainEvent:
        seq = next(self._uow.store.ids)
        saved = event.model_copy(update={"seq": seq})
        self.rows[seq] = saved
        return saved

    def list_recent(self, project_id: int, before_seq: int | None, limit: int) -> list[DomainEvent]:
        rows = [e for s, e in sorted(self.rows.items(), reverse=True) if e.project_id == project_id and (before_seq is None or s < before_seq)]
        return rows[:limit]

    def list_after(self, project_id: int, after_seq: int, limit: int) -> list[DomainEvent]:
        rows = [e for s, e in sorted(self.rows.items()) if e.project_id == project_id and s > after_seq]
        return rows[:limit]


class FakeExternalLinkRepository(_Repo):
    def __init__(self, uow: "InMemoryUnitOfWork"):
        super().__init__(uow, "links")

    def _all(self) -> list[ExternalLink]:
        return [link.model_copy(deep=True) for _, link in sorted(self.rows.items())]

    def get_issue(self, task_id: int) -> ExternalLink | None:
        issues = [link for link in self._all() if link.task_id == task_id and link.kind == "issue"]
        return issues[-1] if issues else None

    def list_by_project(self, project_id: int, kind: ExternalKind | None = None) -> list[ExternalLink]:
        return [link for link in self._all() if link.project_id == project_id and kind in (None, link.kind)]

    def find(self, repository: str, number: int, kind: ExternalKind) -> list[ExternalLink]:
        return [
            link for link in self._all() if link.repository.lower() == repository.lower() and link.number == number and link.kind == kind
        ]


class FakeOwnWriteRepository(_Repo):
    def __init__(self, uow: "InMemoryUnitOfWork"):
        super().__init__(uow, "own_writes")

    def all(self) -> list[OwnWrite]:
        """Test helper: every recorded write, oldest first."""
        return [write.model_copy(deep=True) for _, write in sorted(self.rows.items())]

    def consume_matching(self, repository: str, number: int, action: OwnWriteAction) -> bool:
        for write in self.all():
            if (write.repository.lower(), write.number, write.action, write.consumed_at) == (repository.lower(), number, action, None):
                self._put(write.model_copy(update={"consumed_at": datetime.now(timezone.utc)}))
                return True
        return False

    def prune_consumed(self, before: datetime) -> int:
        old = [k for k, w in self.rows.items() if w.consumed_at is not None and w.consumed_at < before]
        for key in old:
            del self.rows[key]
        return len(old)


class FakeWebhookDeliveryRepository(_Repo):
    def __init__(self, uow: "InMemoryUnitOfWork"):
        super().__init__(uow, "deliveries")

    def seen(self, delivery_id: str) -> bool:
        return any(d.delivery_id == delivery_id for d in self.rows.values())

    def all(self) -> list[WebhookDelivery]:
        return [d.model_copy(deep=True) for _, d in sorted(self.rows.items())]

    def prune(self, before: datetime) -> int:
        old = [k for k, d in self.rows.items() if d.received_at < before]
        for key in old:
            del self.rows[key]
        return len(old)


class FakeDocumentRepository(_Repo):
    def __init__(self, uow: "InMemoryUnitOfWork"):
        super().__init__(uow, "documents")

    @property
    def _versions(self) -> dict[int, Any]:
        return self._uow.working.setdefault("document_versions", {})

    def find(self, project_id: int, key: str) -> Document | None:
        return next((d.model_copy(deep=True) for d in self.rows.values() if d.project_id == project_id and d.key == key), None)

    def list_by_project(self, project_id: int) -> list[Document]:
        return [d.model_copy(deep=True) for _, d in sorted(self.rows.items()) if d.project_id == project_id]

    def add_version(self, version: DocumentVersion) -> DocumentVersion:
        saved = version.model_copy(update={"id": next(self._uow.store.ids)})
        self._versions[saved.id] = saved  # type: ignore[index]
        return saved.model_copy(deep=True)

    def versions(self, document_id: int) -> list[DocumentVersion]:
        rows = (v.model_copy(deep=True) for v in self._versions.values() if v.document_id == document_id)
        return sorted(rows, key=lambda v: v.version)


class InMemoryUnitOfWork:
    """Implements the UnitOfWork port. Several instances can share one store, like
    sessions sharing a database: what one commits, the next one sees."""

    def __init__(self, store: _Store | None = None):
        self.store = store or _Store()
        self.working: dict[str, dict[int, Any]] = {}
        self.commits = 0
        self._reset()
        self.projects = FakeProjectRepository(self)
        self.sprints = FakeSprintRepository(self)
        self.objectives = FakeObjectiveRepository(self)
        self.tasks = FakeTaskRepository(self)
        self.proposals = FakeProposalRepository(self)
        self.activity = FakeActivityRepository(self)
        self.links = FakeExternalLinkRepository(self)
        self.own_writes = FakeOwnWriteRepository(self)
        self.deliveries = FakeWebhookDeliveryRepository(self)
        self.documents = FakeDocumentRepository(self)

    def _reset(self) -> None:
        self.working = {name: {k: v.model_copy(deep=True) for k, v in rows.items()} for name, rows in self.store.committed.items()}

    def __enter__(self) -> Self:
        self._reset()
        return self

    def __exit__(self, *exc: object) -> None:
        self.rollback()

    def commit(self) -> None:
        self.store.committed = {name: {k: v.model_copy(deep=True) for k, v in rows.items()} for name, rows in self.working.items()}
        self.commits += 1

    def rollback(self) -> None:
        self._reset()

    def factory(self) -> Callable[[], "InMemoryUnitOfWork"]:
        """A UnitOfWorkFactory whose units share this one's store."""
        return lambda: InMemoryUnitOfWork(self.store)


class RecordingEventBus:
    """Implements the EventBus port and keeps what was published, with a seq like the real bus."""

    def __init__(self) -> None:
        self.events: list[DomainEvent] = []

    async def publish(self, event: DomainEvent) -> None:
        self.events.append(event.model_copy(update={"seq": len(self.events) + 1}))

    def of_type(self, type_: str) -> list[DomainEvent]:
        return [e for e in self.events if e.type == type_]

    async def subscribe(self, project_id: int) -> AsyncIterator[DomainEvent]:
        for event in list(self.events):
            if event.project_id == project_id:
                yield event


class CodeHosts:
    """A CodeHostFactory (spec 007) that hands out one FakeCodeHost and remembers the tokens asked for."""

    def __init__(self, host: FakeCodeHost | None = None):
        self.host = host or FakeCodeHost()
        self.tokens: list[str | None] = []
        self.on_retry: OnRetry | None = None  # the last one handed in

    def __call__(self, token: str | None, on_retry: OnRetry | None = None) -> FakeCodeHost:
        self.tokens.append(token)
        self.on_retry = on_retry
        return self.host


def project(**overrides: Any) -> Project:
    """A valid two-member project for tests."""
    data: dict[str, Any] = {
        "name": "Agile Planner",
        "description": "Jira-like tool where AI agents plan the work.",
        "members": [Member(name="Ana Gómez", role="Backend", seniority="senior", hours_per_week=30), Member(name="Leo Ruiz", role="Frontend")],
    }
    return Project(**{**data, **overrides})
