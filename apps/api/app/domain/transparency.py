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


PhaseTaskStatus = Literal["done", "in_progress", "pending"]


class PhaseTask(BaseModel):
    """A board task as the public sees it (FR-024): its title and where it stands, nothing about who does it."""

    id: int
    title: str
    status: PhaseTaskStatus
    done_on: dt.date | None = None


class SprintProgress(BaseModel):
    name: str
    goal: str
    end_date: dt.date | None
    done_points: int
    total_points: int
    # Done first (in the order they were finished), then in progress, then pending (in board order).
    tasks: list[PhaseTask] = []


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
    """The contract's last day, inclusive: 26 weeks from Monday 2026-08-03 end on Sunday 2027-01-31."""
    return budget.start_date + dt.timedelta(weeks=duration_weeks, days=-1)


def cop(amount: int) -> str:
    """1850000 → "$1.850.000" (Colombian pesos, dots as thousands separator)."""
    return ("-" if amount < 0 else "") + "$" + f"{abs(amount):,}".replace(",", ".")


def _num(value: float) -> str:
    """15.0 → "15", 15.25 → "15,3": how the reasons write percentages and points."""
    return f"{value:.1f}".rstrip("0").rstrip(".").replace(".", ",")


def _pct(part: float, whole: float) -> float:
    return round(part / whole * 100, 1) if whole else 0.0


def _spent(expenses: list[Expense]) -> int:
    return sum(e.amount or 0 for e in expenses)


def _text_error(errors: list[FieldError], field: str, value: str, max_len: int) -> None:
    if not value.strip():
        errors.append(FieldError(field, "Required."))
    elif len(value.strip()) > max_len:
        errors.append(FieldError(field, f"Max {max_len} characters."))


def budget_errors(budget: Budget) -> list[FieldError]:
    errors: list[FieldError] = []
    _text_error(errors, "contracting_entity", budget.contracting_entity, LINE_NAME_MAX)
    _text_error(errors, "contractor", budget.contractor, LINE_NAME_MAX)
    if budget.contract_value <= 0:
        errors.append(FieldError("contract_value", "Must be greater than 0."))
    seen: set[str] = set()
    for i, line in enumerate(budget.lines):
        if not line.id.strip():
            errors.append(FieldError(f"lines[{i}].id", "Required."))
        elif line.id in seen:
            errors.append(FieldError(f"lines[{i}].id", f"'{line.id}' is repeated."))
        seen.add(line.id)
        _text_error(errors, f"lines[{i}].name", line.name, LINE_NAME_MAX)
        if line.amount < 0:
            errors.append(FieldError(f"lines[{i}].amount", "Can't be negative."))
    return errors


def confirmation_errors(confirmation: ExpenseConfirmation, budget: Budget, task_ids: set[int]) -> list[FieldError]:
    errors: list[FieldError] = []
    if confirmation.amount is not None and confirmation.amount < 0:
        errors.append(FieldError("amount", "Can't be negative."))
    if confirmation.budget_line_id is not None and confirmation.budget_line_id not in {line.id for line in budget.lines}:
        errors.append(FieldError("budget_line_id", f"The budget has no line '{confirmation.budget_line_id}'."))
    if confirmation.task_id is not None and confirmation.task_id not in task_ids:
        errors.append(FieldError("task_id", f"The project has no task {confirmation.task_id}."))
    _text_error(errors, "citizen_summary", confirmation.citizen_summary, CITIZEN_SUMMARY_MAX)
    return errors


def line_status(budget: Budget, expenses: list[Expense]) -> list[LineStatus]:
    """Spent and available per line; available goes negative when the line is overspent."""
    spent = {line.id: 0 for line in budget.lines}
    for expense in expenses:
        if expense.budget_line_id in spent:
            spent[expense.budget_line_id] += expense.amount or 0
    return [
        LineStatus(id=line.id, name=line.name, amount=line.amount, spent=spent[line.id], available=line.amount - spent[line.id])
        for line in budget.lines
    ]


def physical_progress(tasks: list[Task]) -> float | None:
    """Done points over all points (D5); None when there's nothing planned."""
    total = sum(t.points for t in tasks)
    if total <= 0:
        return None
    return _pct(sum(t.points for t in tasks if t.status == "done"), total)


def time_elapsed(start: dt.date, end: dt.date, today: dt.date) -> float:
    days = (end - start).days
    if days <= 0:
        return 100.0
    return round(min(max((today - start).days / days * 100, 0.0), 100.0), 1)


def summary(budget: Budget, end: dt.date, expenses: list[Expense], tasks: list[Task], today: dt.date) -> Summary:
    spent = _spent(expenses)
    spent_pct = _pct(spent, budget.contract_value)
    physical_pct = physical_progress(tasks)
    time_pct = time_elapsed(budget.start_date, end, today)
    light, reasons = traffic_light(spent_pct, physical_pct, time_pct, [a for e in expenses for a in e.alerts])
    return Summary(
        spent=spent,
        spent_pct=spent_pct,
        physical_pct=physical_pct,
        time_pct=time_pct,
        unallocated=budget.contract_value - sum(line.amount for line in budget.lines),
        light=light,
        reasons=reasons,
    )


def _alerts_reason(count: int, level: str) -> str:
    return f"Hay {count} alerta{'s' if count > 1 else ''} de nivel {level} en revisión"


def traffic_light(
    spent_pct: float, physical_pct: float | None, time_pct: float, alerts: list[Alert]
) -> tuple[Light, list[str]]:
    """FR-008. Every alert counts, answered or not (D12); low ones don't change the color.
    Returns the color and one reason per trigger, worst first."""
    red: list[str] = []
    yellow: list[str] = []
    high = sum(1 for a in alerts if a.level == "high")
    medium = sum(1 for a in alerts if a.level == "medium")
    if high:
        red.append(_alerts_reason(high, "alto"))
    if spent_pct > 100:
        red.append(f"El gasto ({_num(spent_pct)}%) supera el valor del contrato")
    if physical_pct is not None:
        gap = spent_pct - physical_pct
        if gap > 10:
            (red if gap > 25 else yellow).append(f"Se ha gastado {_num(gap)} puntos más de lo que se ha avanzado")
        lag = time_pct - physical_pct
        if lag > 20:
            yellow.append(
                f"El tiempo transcurrido ({_num(time_pct)}%) va {_num(lag)} puntos por delante del avance ({_num(physical_pct)}%)"
            )
    if medium:
        yellow.append(_alerts_reason(medium, "medio"))
    if red:
        return "red", red + yellow
    if yellow:
        return "yellow", yellow
    return "green", ["El gasto va acorde con el avance de las actividades"]


def _monday(day: dt.date) -> dt.date:
    return day - dt.timedelta(days=day.weekday())


def weekly_timeline(
    budget: Budget, end: dt.date, expenses: list[Expense], tasks: list[Task], today: dt.date
) -> list[WeekEntry]:
    """FR-009: one entry per week (Monday to Sunday) from the start's week to the week of
    min(today, end). Expenses and done tasks dated outside that span count in the first or
    last week, so the accumulated values end where the summary does. Tasks done before
    spec 017 (no `done_at`) count in the summary but not in any week."""
    last_day = min(today, end)
    if last_day < budget.start_date:
        return []
    weeks: list[dt.date] = []
    week = _monday(budget.start_date)
    while week <= last_day:
        weeks.append(week)
        week += dt.timedelta(weeks=1)

    def index(day: dt.date) -> int:
        return min(max((day - weeks[0]).days // 7, 0), len(weeks) - 1)

    spent = [0] * len(weeks)
    for expense in expenses:
        spent[index(expense.date or expense.created_at.date())] += expense.amount or 0
    done: list[list[Task]] = [[] for _ in weeks]
    for task in sorted((t for t in tasks if t.done_at is not None), key=lambda t: t.done_at):  # type: ignore[arg-type, return-value]
        done[index(task.done_at.date())].append(task)  # type: ignore[union-attr]

    total_points = sum(t.points for t in tasks)
    entries: list[WeekEntry] = []
    spent_acc = points_acc = 0
    for i, week_start in enumerate(weeks):
        spent_acc += spent[i]
        points_acc += sum(t.points for t in done[i])
        entries.append(
            WeekEntry(
                week_start=week_start,
                tasks_done=[TaskRef(id=t.id, title=t.title) for t in done[i] if t.id is not None],
                spent=spent[i],
                spent_pct_acc=_pct(spent_acc, budget.contract_value),
                physical_pct_acc=_pct(points_acc, total_points),
            )
        )
    return entries


def _phase_status(task: Task) -> PhaseTaskStatus:
    if task.status == "done":
        return "done"
    return "in_progress" if task.status in ("in_progress", "review") else "pending"


def _phase_tasks(tasks: list[Task]) -> list[PhaseTask]:
    order = {"done": 0, "in_progress": 1, "pending": 2}
    rows = sorted(
        (t for t in tasks if t.id is not None),
        key=lambda t: (order[_phase_status(t)], t.done_at or dt.datetime.max.replace(tzinfo=dt.timezone.utc), t.position, t.id),
    )
    return [
        PhaseTask(id=t.id, title=t.title, status=_phase_status(t), done_on=t.done_at.date() if t.done_at else None)  # type: ignore[arg-type]
        for t in rows
    ]


def sprint_progress(sprints: list[Sprint], tasks: list[Task]) -> list[SprintProgress]:
    return [
        SprintProgress(
            name=sprint.name,
            goal=sprint.goal,
            end_date=sprint.end_date,
            done_points=sum(t.points for t in tasks if t.sprint_id == sprint.id and t.status == "done"),
            total_points=sum(t.points for t in tasks if t.sprint_id == sprint.id),
            tasks=_phase_tasks([t for t in tasks if t.sprint_id == sprint.id]),
        )
        for sprint in sorted(sprints, key=lambda s: s.number)
    ]


def rule_alerts(budget: Budget, end: dt.date, confirmed: list[Expense], expense: Expense) -> list[AlertDraft]:
    """FR-005, on confirming. `confirmed` doesn't include `expense`."""
    alerts: list[AlertDraft] = []
    line = next((line for line in budget.lines if line.id == expense.budget_line_id), None)
    if expense.amount is not None and line is not None:
        available = line.amount - _spent([e for e in confirmed if e.budget_line_id == line.id])
        if expense.amount > available:
            alerts.append(
                AlertDraft(
                    level="high",
                    reason=f"El gasto de {cop(expense.amount)} supera lo disponible en el rubro {line.name} ({cop(max(available, 0))})",
                )
            )
    if expense.date is not None and not budget.start_date <= expense.date <= end:
        alerts.append(
            AlertDraft(
                level="medium",
                reason=f"La fecha del gasto ({expense.date.isoformat()}) está fuera del periodo del contrato "
                f"({budget.start_date.isoformat()} a {end.isoformat()})",
            )
        )
    if expense.amount and line is None:
        alerts.append(AlertDraft(level="low", reason="Gasto sin rubro asignado"))
    return alerts


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
