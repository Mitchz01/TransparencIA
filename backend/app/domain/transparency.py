"""Public transparency portal (spec 017): a project's budget, the expenses its evidence proves, the
alerts on them, and the numbers the portal shows. Every number and the traffic light come from the
rules below, never from the AI (spec 017, "Credibility rules"); the AI only fills EvidenceReading and
CitizenAnswer drafts that a person confirms."""

import datetime as dt
from typing import Literal

from pydantic import BaseModel, Field

from app.domain.board import Sprint, Task
from app.domain.errors import DomainError, FieldError, NotFound

ExpenseKind = Literal["invoice", "field_photo", "report"]
ExpenseStatus = Literal["draft", "confirmed"]
AlertLevel = Literal["high", "medium", "low"]
AlertSource = Literal["ai", "rule"]
Light = Literal["green", "yellow", "red"]

UPLOAD_MAX_BYTES = 10 * 1024 * 1024
UPLOAD_MIMES = ("application/pdf", "image/jpeg", "image/png", "image/webp")
LINE_NAME_MAX = 120
CITIZEN_SUMMARY_MAX = 200
ANSWER_MAX = 500
QUESTION_MAX = 300


def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


# ---------- Entities ----------


class BudgetLine(BaseModel):
    id: str  # "R1", "R2"… sent by the client, kept by the server
    name: str
    amount: int  # COP, no cents


class Budget(BaseModel):
    project_id: int
    contracting_entity: str
    contractor: str
    contract_value: int
    start_date: dt.date
    lines: list[BudgetLine] = []


class Alert(BaseModel):
    id: int | None = None
    expense_id: int | None = None
    level: AlertLevel
    reason: str
    source: AlertSource
    # The executing entity's public answer (US5); an answered alert still counts (D12).
    answer: str | None = None
    answered_at: dt.datetime | None = None


class Expense(BaseModel):
    id: int | None = None
    project_id: int
    file_id: int
    mime: str
    kind: ExpenseKind
    status: ExpenseStatus = "draft"
    amount: int | None = None  # None for photos
    date: dt.date | None = None
    supplier: str | None = None
    concept: str | None = None
    budget_line_id: str | None = None
    task_id: int | None = None
    task_title: str | None = None  # kept if the task is deleted from the board
    citizen_summary: str = ""
    alerts: list[Alert] = []
    created_at: dt.datetime = Field(default_factory=_now)


class StoredFile(BaseModel):
    id: int | None = None
    project_id: int
    name: str
    mime: str
    data: bytes


class ExpenseConfirmation(BaseModel):
    """Body of POST /api/projects/{id}/expenses/{expenseId}/confirm."""

    kind: ExpenseKind
    amount: int | None
    date: dt.date | None
    supplier: str | None
    concept: str | None
    budget_line_id: str | None
    task_id: int | None
    citizen_summary: str


# ---------- Agent outputs (output_schema) ----------


class AlertDraft(BaseModel):
    level: AlertLevel
    reason: str


class EvidenceReading(BaseModel):
    kind: ExpenseKind
    amount: int | None
    date: dt.date | None
    supplier: str | None
    concept: str | None
    budget_line_id: str | None
    task_id: int | None
    citizen_summary: str
    alerts: list[AlertDraft]


class CitizenAnswer(BaseModel):
    answer: str


# ---------- Computed: the Portal shape of plan.md ----------


class LineStatus(BaseModel):
    id: str
    name: str
    amount: int
    spent: int
    available: int


class Summary(BaseModel):
    spent: int
    spent_pct: float
    physical_pct: float | None  # None when the project has no task points
    time_pct: float
    unallocated: int
    light: Light
    reasons: list[str]


class TaskRef(BaseModel):
    id: int
    title: str


class WeekEntry(BaseModel):
    week_start: dt.date
    tasks_done: list[TaskRef]
    spent: int
    spent_pct_acc: float
    physical_pct_acc: float


class SprintProgress(BaseModel):
    name: str
    goal: str
    end_date: dt.date | None
    done_points: int
    total_points: int


class PortalProject(BaseModel):
    name: str
    description: str
    contracting_entity: str
    contractor: str
    contract_value: int
    start_date: dt.date
    end_date: dt.date


class Portal(BaseModel):
    project: PortalProject
    summary: Summary
    lines: list[LineStatus]
    timeline: list[WeekEntry]
    sprints: list[SprintProgress]
    expenses: list[Expense]  # confirmed only, newest first
    alerts: list[Alert]
    public_url: str | None


class TeamPortal(Portal):
    drafts: list[Expense]
    public: bool


# ---------- Rules (P1). Pure: `expenses` are the confirmed ones, `today` always comes in ----------


def end_date(budget: Budget, duration_weeks: int) -> dt.date:
    return budget.start_date + dt.timedelta(weeks=duration_weeks)


def cop(amount: int) -> str:
    """1850000 → "$1.850.000" (Colombian pesos, dots as thousands separator)."""
    return "$" + f"{amount:,}".replace(",", ".")


def budget_errors(budget: Budget) -> list[FieldError]:
    raise NotImplementedError


def confirmation_errors(confirmation: ExpenseConfirmation, budget: Budget, task_ids: set[int]) -> list[FieldError]:
    raise NotImplementedError


def line_status(budget: Budget, expenses: list[Expense]) -> list[LineStatus]:
    raise NotImplementedError


def summary(budget: Budget, end: dt.date, expenses: list[Expense], tasks: list[Task], today: dt.date) -> Summary:
    raise NotImplementedError


def traffic_light(
    spent_pct: float, physical_pct: float | None, time_pct: float, alerts: list[Alert]
) -> tuple[Light, list[str]]:
    raise NotImplementedError


def weekly_timeline(
    budget: Budget, end: dt.date, expenses: list[Expense], tasks: list[Task], today: dt.date
) -> list[WeekEntry]:
    raise NotImplementedError


def sprint_progress(sprints: list[Sprint], tasks: list[Task]) -> list[SprintProgress]:
    raise NotImplementedError


def rule_alerts(budget: Budget, end: dt.date, confirmed: list[Expense], expense: Expense) -> list[AlertDraft]:
    """`confirmed` doesn't include `expense`."""
    raise NotImplementedError


# ---------- Errors (plan.md, API Contract) ----------


class ExpenseNotFound(NotFound):
    def __init__(self, id: int | None):
        super().__init__("Expense", id)


class AlertNotFound(NotFound):
    def __init__(self, id: int | None):
        super().__init__("Alert", id)


class FileNotFound(NotFound):
    def __init__(self, id: int | None):
        super().__init__("File", id)


class BudgetMissing(DomainError):
    code = "budget_missing"

    def __init__(self, project_id: int | None):
        super().__init__(f"Project {project_id} has no budget yet.")
        self.project_id = project_id


class ExpenseNotDraft(DomainError):
    code = "expense_not_draft"

    def __init__(self, expense_id: int | None):
        super().__init__(f"Expense {expense_id} is already confirmed.")
        self.expense_id = expense_id


class UnsupportedFile(DomainError):
    code = "unsupported_file"

    def __init__(self, detail: str = "Upload a PDF, JPG, PNG or WebP of up to 10 MB."):
        super().__init__(detail)


class AgentUnavailable(DomainError):
    """Gemini failed or returned something that doesn't validate; nothing is saved."""

    code = "agent_unavailable"

    def __init__(self, detail: str = "We couldn't read the document. Try again or fill it in by hand."):
        super().__init__(detail)
