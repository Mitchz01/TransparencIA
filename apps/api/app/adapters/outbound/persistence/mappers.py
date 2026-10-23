"""Table ↔ domain entity. The fields match, so validating from attributes is
enough; a project's team lives in another table and is assembled separately.

SQLite drops the timezone, so datetimes read back are marked as UTC again
(the API always returns UTC, plan/api-conventions.md)."""

from datetime import datetime, timezone
from typing import Any

from app.adapters.outbound.persistence import token_cipher
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
from app.domain.events import DomainEvent
from app.domain.integrations import ExternalLink, OwnWrite
from app.domain.project import Member, Project
from app.domain.proposals import Proposal
from app.domain.sync import WebhookDelivery
from app.domain.transparency import Alert, Budget, BudgetLine, Expense, StoredFile


def utc(value: datetime | None) -> datetime | None:
    if value is None or value.tzinfo is not None:
        return value
    return value.replace(tzinfo=timezone.utc)


def _with_utc(data: dict[str, Any], *fields: str) -> dict[str, Any]:
    for name in fields:
        data[name] = utc(data.get(name))
    return data


def project_to_domain(row: ProjectTable, members: list[MemberTable]) -> Project:
    data = _with_utc(row.model_dump(), "created_at")
    data["github_token"] = token_cipher.unseal(row.github_token)  # spec 007
    return Project.model_validate({**data, "members": [member_to_domain(m) for m in members]})


def project_to_table(project: Project) -> ProjectTable:
    # github_token, webhook_id (spec 007) and invite_token (spec 015) are excluded from dumps: set them by hand.
    data = project.model_dump(exclude={"members", "has_token"})
    return ProjectTable.model_validate(
        {
            **data,
            "github_token": token_cipher.seal(project.github_token),
            "webhook_id": project.webhook_id,
            "invite_token": project.invite_token,
        }
    )


def member_to_domain(row: MemberTable) -> Member:
    return Member.model_validate(row.model_dump(exclude={"project_id", "active"}))


def member_to_table(member: Member, project_id: int) -> MemberTable:
    return MemberTable.model_validate({**member.model_dump(), "project_id": project_id})


def sprint_to_domain(row: SprintTable) -> Sprint:
    return Sprint.model_validate(row.model_dump())


def sprint_to_table(sprint: Sprint) -> SprintTable:
    return SprintTable.model_validate(sprint.model_dump())


def task_to_domain(row: TaskTable) -> Task:
    return Task.model_validate(_with_utc(row.model_dump(), "done_at"))


def task_to_table(task: Task) -> TaskTable:
    return TaskTable.model_validate(task.model_dump())


def objective_to_domain(row: ObjectiveTable) -> Objective:
    return Objective.model_validate(row.model_dump())


def objective_to_table(objective: Objective) -> ObjectiveTable:
    return ObjectiveTable.model_validate(objective.model_dump())


def proposal_to_domain(row: ProposalTable) -> Proposal:
    return Proposal.model_validate(_with_utc(row.model_dump(), "created_at", "resolved_at"))


def proposal_to_table(proposal: Proposal) -> ProposalTable:
    return ProposalTable.model_validate(proposal.model_dump())


def document_to_domain(row: DocumentTable) -> Document:
    return Document.model_validate(_with_utc(row.model_dump(), "updated_at"))


def document_to_table(document: Document) -> DocumentTable:
    return DocumentTable.model_validate(document.model_dump())


def document_version_to_domain(row: DocumentVersionTable) -> DocumentVersion:
    return DocumentVersion.model_validate(_with_utc(row.model_dump(), "created_at"))


def document_version_to_table(version: DocumentVersion) -> DocumentVersionTable:
    return DocumentVersionTable.model_validate(version.model_dump())


def activity_to_table(event: DomainEvent) -> ActivityTable:
    return ActivityTable(
        project_id=event.project_id or 0,
        type=event.type,
        occurred_at=event.occurred_at,
        payload=event.model_dump(mode="json", exclude={"seq"}),
    )


def activity_to_domain(row: ActivityTable) -> DomainEvent:
    """Events are read back generically: the payload keeps every type-specific field."""
    return DomainEvent.model_validate({**row.payload, "seq": row.id, "occurred_at": utc(row.occurred_at)})


# ---------- GitHub integration (spec 007) ----------


def external_link_to_domain(row: ExternalLinkTable) -> ExternalLink:
    return ExternalLink.model_validate(row.model_dump())


def external_link_to_table(link: ExternalLink) -> ExternalLinkTable:
    return ExternalLinkTable.model_validate(link.model_dump())


def own_write_to_domain(row: OwnWriteTable) -> OwnWrite:
    return OwnWrite.model_validate(_with_utc(row.model_dump(), "created_at", "consumed_at"))


def own_write_to_table(write: OwnWrite) -> OwnWriteTable:
    return OwnWriteTable.model_validate(write.model_dump())


# ---------- GitHub sync (spec 008) ----------


def delivery_to_domain(row: WebhookDeliveryTable) -> WebhookDelivery:
    return WebhookDelivery.model_validate(_with_utc(row.model_dump(), "received_at"))


def delivery_to_table(delivery: WebhookDelivery) -> WebhookDeliveryTable:
    return WebhookDeliveryTable.model_validate(delivery.model_dump())


# ---------- Accounts (spec 015) ----------


def account_to_domain(row: AccountTable) -> Account:
    return Account.model_validate(_with_utc(row.model_dump(), "created_at"))


def account_to_table(account: Account) -> AccountTable:
    # password_hash is excluded from dumps (FR-003): set it by hand.
    return AccountTable.model_validate({**account.model_dump(), "password_hash": account.password_hash})


def session_to_domain(row: SessionTable) -> AuthSession:
    return AuthSession.model_validate(_with_utc(row.model_dump(), "created_at", "expires_at"))


def session_to_table(session: AuthSession) -> SessionTable:
    return SessionTable.model_validate(session.model_dump())


# ---------- Transparency portal (spec 017) ----------


def budget_to_domain(row: BudgetTable) -> Budget:
    return Budget.model_validate({**row.model_dump(), "lines": [BudgetLine.model_validate(line) for line in row.lines]})


def budget_to_table(budget: Budget) -> BudgetTable:
    return BudgetTable.model_validate({**budget.model_dump(mode="json"), "start_date": budget.start_date})


def alert_to_domain(row: AlertTable) -> Alert:
    return Alert.model_validate(_with_utc(row.model_dump(), "answered_at"))


def alert_to_table(alert: Alert, expense_id: int) -> AlertTable:
    return AlertTable.model_validate({**alert.model_dump(), "expense_id": expense_id})


def expense_to_domain(row: ExpenseTable, alerts: list[AlertTable]) -> Expense:
    data = _with_utc(row.model_dump(), "created_at")
    return Expense.model_validate({**data, "alerts": [alert_to_domain(a) for a in alerts]})


def expense_to_table(expense: Expense) -> ExpenseTable:
    # The alerts live in their own table: the repository writes them.
    return ExpenseTable.model_validate(expense.model_dump(exclude={"alerts"}))


def stored_file_to_domain(row: StoredFileTable) -> StoredFile:
    return StoredFile.model_validate(row.model_dump())


def stored_file_to_table(file: StoredFile) -> StoredFileTable:
    return StoredFileTable.model_validate(file.model_dump())
