from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import delete, func, update
from sqlmodel import Session, col, select

from app.adapters.outbound.persistence import mappers
from app.adapters.outbound.persistence.tables import (
    AccountTable,
    AlertTable,
    BudgetTable,
    ExpenseTable,
    StoredFileTable,
    ActivityTable,
    ExternalLinkTable,
    DocumentTable,
    DocumentVersionTable,
    MemberTable,
    ObjectiveTable,
    OwnWriteTable,
    ProjectTable,
    ProposalTable,
    SessionTable,
    SprintTable,
    TaskTable,
    WebhookDeliveryTable,
)
from app.domain.accounts import Account, AuthSession
from app.domain.board import Objective, Sprint, Task
from app.domain.documents import Document, DocumentVersion
from app.domain.errors import ProposalAlreadyResolved
from app.domain.events import DomainEvent
from app.domain.integrations import ExternalKind, ExternalLink, OwnWrite, OwnWriteAction
from app.domain.project import Project
from app.domain.proposals import Proposal, ProposalStatus
from app.domain.sync import WebhookDelivery
from app.domain.transparency import Alert, Budget, Expense, ExpenseStatus, StoredFile


class SqlProjectRepository:
    def __init__(self, session: Session):
        self._session = session

    def get(self, project_id: int) -> Project | None:
        row = self._session.get(ProjectTable, project_id)
        return self._to_domain(row) if row else None

    def list(self) -> list[Project]:
        rows = self._session.exec(select(ProjectTable).order_by(ProjectTable.id)).all()
        return [self._to_domain(row) for row in rows]

    def add(self, project: Project) -> Project:
        row = mappers.project_to_table(project)
        self._session.add(row)
        self._session.flush()
        for member in project.members:
            self._session.add(mappers.member_to_table(member, row.id))
        self._session.flush()
        return self._to_domain(row)

    def save(self, project: Project) -> Project:
        """Saves the project and syncs its team: members with an id are updated, members
        without one are inserted, and current members missing from the list are deactivated
        (never deleted, so done tasks keep their assignee)."""
        row = self._session.merge(mappers.project_to_table(project))
        # Read the current team before inserting, or autoflush would count new members as missing.
        current_members = self._active_members(row.id)
        kept = {m.id for m in project.members if m.id is not None}
        for current in current_members:
            if current.id not in kept:
                current.active = False
                self._session.add(current)
        for member in project.members:
            member_row = mappers.member_to_table(member, row.id)
            if member.id is None:
                self._session.add(member_row)
            else:
                self._session.merge(member_row)
        self._session.flush()
        return self._to_domain(row)

    def _active_members(self, project_id: int | None) -> list[MemberTable]:
        return list(
            self._session.exec(
                select(MemberTable)
                .where(MemberTable.project_id == project_id, col(MemberTable.active).is_(True))
                .order_by(MemberTable.id)
            ).all()
        )

    def _to_domain(self, row: ProjectTable) -> Project:
        return mappers.project_to_domain(row, self._active_members(row.id))

    def get_by_member(self, member_id: int) -> Project | None:
        """The project of an active member (spec 007)."""
        member = self._session.get(MemberTable, member_id)
        return self.get(member.project_id) if member and member.active else None

    def get_by_repository(self, repository: str) -> Project | None:
        """The project connected to `owner/name`, case-insensitive like GitHub (spec 007)."""
        row = self._session.exec(
            select(ProjectTable).where(func.lower(ProjectTable.repository) == repository.lower()).order_by(ProjectTable.id)
        ).first()
        return self._to_domain(row) if row else None

    def list_by_account(self, account_id: int) -> list[Project]:
        """Projects where the account is an active member (spec 015)."""
        rows = self._session.exec(
            select(ProjectTable)
            .join(MemberTable, col(MemberTable.project_id) == ProjectTable.id)
            .where(MemberTable.account_id == account_id, col(MemberTable.active).is_(True))
            .order_by(ProjectTable.id)
        ).all()
        return [self._to_domain(row) for row in rows]

    def get_by_invite_token(self, token: str) -> Project | None:
        row = self._session.exec(select(ProjectTable).where(ProjectTable.invite_token == token)).first()
        return self._to_domain(row) if row else None

    def get_by_public_slug(self, slug: str) -> Project | None:
        row = self._session.exec(select(ProjectTable).where(ProjectTable.public_slug == slug)).first()
        return self._to_domain(row) if row else None


class SqlSprintRepository:
    def __init__(self, session: Session):
        self._session = session

    def get(self, sprint_id: int) -> Sprint | None:
        row = self._session.get(SprintTable, sprint_id)
        return mappers.sprint_to_domain(row) if row else None

    def list_by_project(self, project_id: int) -> list[Sprint]:
        rows = self._session.exec(
            select(SprintTable).where(SprintTable.project_id == project_id).order_by(SprintTable.number)
        ).all()
        return [mappers.sprint_to_domain(row) for row in rows]

    def add(self, sprint: Sprint) -> Sprint:
        row = mappers.sprint_to_table(sprint)
        self._session.add(row)
        self._session.flush()
        return mappers.sprint_to_domain(row)

    def save(self, sprint: Sprint) -> Sprint:
        row = self._session.merge(mappers.sprint_to_table(sprint))
        self._session.flush()
        return mappers.sprint_to_domain(row)


class SqlObjectiveRepository:
    def __init__(self, session: Session):
        self._session = session

    def list_by_project(self, project_id: int) -> list[Objective]:
        rows = self._session.exec(
            select(ObjectiveTable).where(ObjectiveTable.project_id == project_id).order_by(ObjectiveTable.id)
        ).all()
        return [mappers.objective_to_domain(row) for row in rows]

    def add(self, objective: Objective) -> Objective:
        row = mappers.objective_to_table(objective)
        self._session.add(row)
        self._session.flush()
        return mappers.objective_to_domain(row)

    def save(self, objective: Objective) -> Objective:
        row = self._session.merge(mappers.objective_to_table(objective))
        self._session.flush()
        return mappers.objective_to_domain(row)


class SqlTaskRepository:
    def __init__(self, session: Session):
        self._session = session

    def get(self, task_id: int) -> Task | None:
        row = self._session.get(TaskTable, task_id)
        return mappers.task_to_domain(row) if row else None

    def list_by_project(self, project_id: int) -> list[Task]:
        rows = self._session.exec(
            select(TaskTable).where(TaskTable.project_id == project_id).order_by(TaskTable.position)
        ).all()
        return [mappers.task_to_domain(row) for row in rows]

    def add(self, task: Task) -> Task:
        row = mappers.task_to_table(task)
        self._session.add(row)
        self._session.flush()
        return mappers.task_to_domain(row)

    def save(self, task: Task) -> Task:
        row = self._session.merge(mappers.task_to_table(task))
        self._session.flush()
        return mappers.task_to_domain(row)

    def delete(self, task_id: int) -> None:
        row = self._session.get(TaskTable, task_id)
        if row is not None:
            self._session.delete(row)
            self._session.flush()


class SqlProposalRepository:
    def __init__(self, session: Session):
        self._session = session

    def get(self, proposal_id: int) -> Proposal | None:
        row = self._session.get(ProposalTable, proposal_id)
        return mappers.proposal_to_domain(row) if row else None

    def list_by_project(self, project_id: int) -> list[Proposal]:
        """Newest first."""
        rows = self._session.exec(
            select(ProposalTable)
            .where(ProposalTable.project_id == project_id)
            .order_by(col(ProposalTable.created_at).desc(), col(ProposalTable.id).desc())
        ).all()
        return [mappers.proposal_to_domain(row) for row in rows]

    def add(self, proposal: Proposal) -> Proposal:
        row = mappers.proposal_to_table(proposal)
        self._session.add(row)
        self._session.flush()
        return mappers.proposal_to_domain(row)

    def save(self, proposal: Proposal) -> Proposal:
        row = self._session.merge(mappers.proposal_to_table(proposal))
        self._session.flush()
        return mappers.proposal_to_domain(row)

    def save_if_status(self, proposal: Proposal, expected: ProposalStatus) -> Proposal:
        """Saves only if the stored row is still in `expected`: of two simultaneous
        decisions, the second one gets ProposalAlreadyResolved."""
        values = mappers.proposal_to_table(proposal).model_dump(exclude={"id"})
        result = self._session.exec(  # type: ignore[call-overload]
            update(ProposalTable)
            .where(col(ProposalTable.id) == proposal.id, col(ProposalTable.status) == expected)
            .values(**values)
        )
        if result.rowcount == 0:
            current = self._session.get(ProposalTable, proposal.id)
            raise ProposalAlreadyResolved(proposal.id, current.status if current else "missing")
        self._session.flush()
        self._session.expire_all()
        return self.get(proposal.id)  # type: ignore[arg-type, return-value]


class SqlActivityRepository:
    """Read side of the activity log; PersistentEventBus writes it."""

    def __init__(self, session: Session):
        self._session = session

    def add(self, event: DomainEvent) -> DomainEvent:
        row = mappers.activity_to_table(event)
        self._session.add(row)
        self._session.flush()
        return mappers.activity_to_domain(row)

    def list_recent(self, project_id: int, before_seq: int | None, limit: int) -> list[DomainEvent]:
        """Newest first, strictly before `before_seq` when given."""
        query = select(ActivityTable).where(ActivityTable.project_id == project_id)
        if before_seq is not None:
            query = query.where(col(ActivityTable.id) < before_seq)
        rows = self._session.exec(query.order_by(col(ActivityTable.id).desc()).limit(limit)).all()
        return [mappers.activity_to_domain(row) for row in rows]

    def list_after(self, project_id: int, after_seq: int, limit: int) -> list[DomainEvent]:
        """Oldest first, strictly after `after_seq` (SSE replay)."""
        rows = self._session.exec(
            select(ActivityTable)
            .where(ActivityTable.project_id == project_id, col(ActivityTable.id) > after_seq)
            .order_by(col(ActivityTable.id))
            .limit(limit)
        ).all()
        return [mappers.activity_to_domain(row) for row in rows]


# ---------- GitHub integration (spec 007) ----------


class SqlExternalLinkRepository:
    def __init__(self, session: Session):
        self._session = session

    def get_issue(self, task_id: int) -> ExternalLink | None:
        """The task's newest issue link (an older one may be broken)."""
        row = self._session.exec(
            select(ExternalLinkTable)
            .where(ExternalLinkTable.task_id == task_id, ExternalLinkTable.kind == "issue")
            .order_by(col(ExternalLinkTable.id).desc())
        ).first()
        return mappers.external_link_to_domain(row) if row else None

    def list_by_project(self, project_id: int, kind: ExternalKind | None = None) -> list[ExternalLink]:
        query = select(ExternalLinkTable).where(ExternalLinkTable.project_id == project_id)
        if kind is not None:
            query = query.where(ExternalLinkTable.kind == kind)
        rows = self._session.exec(query.order_by(ExternalLinkTable.id)).all()
        return [mappers.external_link_to_domain(row) for row in rows]

    def find(self, repository: str, number: int, kind: ExternalKind) -> list[ExternalLink]:
        """Links to one issue (at most one task) or PR (one per task it closes)."""
        rows = self._session.exec(
            select(ExternalLinkTable)
            .where(
                func.lower(ExternalLinkTable.repository) == repository.lower(),
                ExternalLinkTable.number == number,
                ExternalLinkTable.kind == kind,
            )
            .order_by(ExternalLinkTable.id)
        ).all()
        return [mappers.external_link_to_domain(row) for row in rows]

    def add(self, link: ExternalLink) -> ExternalLink:
        row = mappers.external_link_to_table(link)
        self._session.add(row)
        self._session.flush()
        return mappers.external_link_to_domain(row)

    def save(self, link: ExternalLink) -> ExternalLink:
        row = self._session.merge(mappers.external_link_to_table(link))
        self._session.flush()
        return mappers.external_link_to_domain(row)


class SqlOwnWriteRepository:
    def __init__(self, session: Session):
        self._session = session

    def add(self, write: OwnWrite) -> OwnWrite:
        row = mappers.own_write_to_table(write)
        self._session.add(row)
        self._session.flush()
        return mappers.own_write_to_domain(row)

    def consume_matching(self, repository: str, number: int, action: OwnWriteAction) -> bool:
        """Marks the oldest unconsumed matching write as consumed; False if there's none."""
        row = self._session.exec(
            select(OwnWriteTable)
            .where(
                func.lower(OwnWriteTable.repository) == repository.lower(),
                OwnWriteTable.number == number,
                OwnWriteTable.action == action,
                col(OwnWriteTable.consumed_at).is_(None),
            )
            .order_by(OwnWriteTable.id)
        ).first()
        if row is None:
            return False
        row.consumed_at = datetime.now(timezone.utc)
        self._session.add(row)
        self._session.flush()
        return True

    def prune_consumed(self, before: datetime) -> int:
        """Spec 008: unconsumed writes are kept, their echo may still arrive."""
        result = self._session.exec(  # type: ignore[call-overload]
            delete(OwnWriteTable).where(
                col(OwnWriteTable.consumed_at).is_not(None), col(OwnWriteTable.consumed_at) < before
            )
        )
        self._session.flush()
        return result.rowcount or 0


# ---------- GitHub sync (spec 008) ----------


class SqlWebhookDeliveryRepository:
    def __init__(self, session: Session):
        self._session = session

    def seen(self, delivery_id: str) -> bool:
        return self._session.exec(
            select(WebhookDeliveryTable.id).where(WebhookDeliveryTable.delivery_id == delivery_id)
        ).first() is not None

    def add(self, delivery: WebhookDelivery) -> WebhookDelivery:
        row = mappers.delivery_to_table(delivery)
        self._session.add(row)
        self._session.flush()
        return mappers.delivery_to_domain(row)

    def prune(self, before: datetime) -> int:
        result = self._session.exec(  # type: ignore[call-overload]
            delete(WebhookDeliveryTable).where(col(WebhookDeliveryTable.received_at) < before)
        )
        self._session.flush()
        return result.rowcount or 0


class SqlDocumentRepository:
    def __init__(self, session: Session):
        self._session = session

    def get(self, document_id: int) -> Document | None:
        row = self._session.get(DocumentTable, document_id)
        return mappers.document_to_domain(row) if row else None

    def find(self, project_id: int, key: str) -> Document | None:
        row = self._session.exec(
            select(DocumentTable).where(DocumentTable.project_id == project_id, DocumentTable.key == key)
        ).first()
        return mappers.document_to_domain(row) if row else None

    def list_by_project(self, project_id: int) -> list[Document]:
        rows = self._session.exec(
            select(DocumentTable).where(DocumentTable.project_id == project_id).order_by(DocumentTable.id)
        ).all()
        return [mappers.document_to_domain(row) for row in rows]

    def add(self, document: Document) -> Document:
        row = mappers.document_to_table(document)
        self._session.add(row)
        self._session.flush()
        return mappers.document_to_domain(row)

    def save(self, document: Document) -> Document:
        row = self._session.merge(mappers.document_to_table(document))
        self._session.flush()
        return mappers.document_to_domain(row)

    def add_version(self, version: DocumentVersion) -> DocumentVersion:
        row = mappers.document_version_to_table(version)
        self._session.add(row)
        self._session.flush()
        return mappers.document_version_to_domain(row)

    def versions(self, document_id: int) -> list[DocumentVersion]:
        rows = self._session.exec(
            select(DocumentVersionTable)
            .where(DocumentVersionTable.document_id == document_id)
            .order_by(DocumentVersionTable.version)
        ).all()
        return [mappers.document_version_to_domain(row) for row in rows]


# ---------- Accounts (spec 015) ----------


class SqlAccountRepository:
    def __init__(self, session: Session):
        self._session = session

    def get(self, account_id: int) -> Account | None:
        row = self._session.get(AccountTable, account_id)
        return mappers.account_to_domain(row) if row else None

    def get_by_email(self, email: str) -> Account | None:
        row = self._session.exec(select(AccountTable).where(AccountTable.email == email)).first()
        return mappers.account_to_domain(row) if row else None

    def add(self, account: Account) -> Account:
        row = mappers.account_to_table(account)
        self._session.add(row)
        self._session.flush()
        return mappers.account_to_domain(row)

    def save(self, account: Account) -> Account:
        row = self._session.merge(mappers.account_to_table(account))
        self._session.flush()
        return mappers.account_to_domain(row)


class SqlSessionRepository:
    def __init__(self, session: Session):
        self._session = session

    def add(self, auth_session: AuthSession) -> AuthSession:
        row = mappers.session_to_table(auth_session)
        self._session.add(row)
        self._session.flush()
        return mappers.session_to_domain(row)

    def get_by_digest(self, digest: str) -> AuthSession | None:
        row = self._session.exec(select(SessionTable).where(SessionTable.token_digest == digest)).first()
        return mappers.session_to_domain(row) if row else None

    def delete(self, session_id: int) -> None:
        self._session.exec(delete(SessionTable).where(col(SessionTable.id) == session_id))  # type: ignore[call-overload]

    def prune_expired(self, now: datetime) -> int:
        result = self._session.exec(delete(SessionTable).where(col(SessionTable.expires_at) <= now))  # type: ignore[call-overload]
        return result.rowcount or 0


# ---------- Transparency portal (spec 017) ----------


class SqlBudgetRepository:
    def __init__(self, session: Session):
        self._session = session

    def get(self, project_id: int) -> Budget | None:
        row = self._session.get(BudgetTable, project_id)
        return mappers.budget_to_domain(row) if row else None

    def save(self, budget: Budget) -> Budget:
        row = self._session.merge(mappers.budget_to_table(budget))
        self._session.flush()
        return mappers.budget_to_domain(row)


class SqlStoredFileRepository:
    def __init__(self, session: Session):
        self._session = session

    def add(self, file: StoredFile) -> StoredFile:
        row = mappers.stored_file_to_table(file)
        self._session.add(row)
        self._session.flush()
        return mappers.stored_file_to_domain(row)

    def get(self, file_id: int) -> StoredFile | None:
        row = self._session.get(StoredFileTable, file_id)
        return mappers.stored_file_to_domain(row) if row else None


class SqlExpenseRepository:
    """An expense and its alerts are one unit: reading assembles it, saving writes both."""

    def __init__(self, session: Session):
        self._session = session

    def get(self, expense_id: int) -> Expense | None:
        row = self._session.get(ExpenseTable, expense_id)
        return self._assemble([row])[0] if row else None

    def list_by_project(self, project_id: int, status: ExpenseStatus | None = None) -> list[Expense]:
        query = select(ExpenseTable).where(ExpenseTable.project_id == project_id)
        if status is not None:
            query = query.where(ExpenseTable.status == status)
        return self._assemble(list(self._session.exec(query.order_by(ExpenseTable.id)).all()))

    def add(self, expense: Expense) -> Expense:
        return self.save(expense.model_copy(update={"id": None}))

    def save(self, expense: Expense) -> Expense:
        row = self._session.merge(mappers.expense_to_table(expense))
        self._session.flush()
        kept = {a.id for a in expense.alerts if a.id is not None}
        for current in self._alert_rows([row.id]):  # type: ignore[list-item]
            if current.id not in kept:
                self._session.delete(current)
        for alert in expense.alerts:
            self._session.merge(mappers.alert_to_table(alert, row.id))  # type: ignore[arg-type]
        self._session.flush()
        return self._assemble([row])[0]

    def delete(self, expense_id: int) -> None:
        row = self._session.get(ExpenseTable, expense_id)
        if row is None:
            return
        for alert in self._alert_rows([expense_id]):
            self._session.delete(alert)
        self._session.delete(row)
        self._session.flush()

    def get_alert(self, alert_id: int) -> Alert | None:
        row = self._session.get(AlertTable, alert_id)
        return mappers.alert_to_domain(row) if row else None

    def save_alert(self, alert: Alert) -> Alert:
        row = self._session.merge(mappers.alert_to_table(alert, alert.expense_id))  # type: ignore[arg-type]
        self._session.flush()
        return mappers.alert_to_domain(row)

    def _alert_rows(self, expense_ids: list[int]) -> list[AlertTable]:
        if not expense_ids:
            return []
        return list(
            self._session.exec(
                select(AlertTable).where(col(AlertTable.expense_id).in_(expense_ids)).order_by(AlertTable.id)
            ).all()
        )

    def _assemble(self, rows: list[ExpenseTable]) -> list[Expense]:
        alerts: dict[int, list[AlertTable]] = {}
        for alert in self._alert_rows([r.id for r in rows if r.id is not None]):
            alerts.setdefault(alert.expense_id, []).append(alert)
        return [mappers.expense_to_domain(row, alerts.get(row.id or 0, [])) for row in rows]
