# Spec 017 — how the 5 of us work in parallel

Read this file (10 min), then only your own brief: [P1 Rules](P1-rules.md) · [P2 AI](P2-ai.md) ·
[P3 API](P3-api.md) · [P4 Team UI](P4-team-ui.md) · [P5 Portal + demo](P5-portal.md).
The what and why is in [../spec.md](../spec.md), the endpoints in [../plan.md](../plan.md#api-contract).

## Rules of the game

1. **You only edit the files listed in your brief.** If you need a change in someone else's file, tell
   them; don't do it yourself.
2. **The skeleton commit (T000) creates every shared file first**: `main.py`, `unit_of_work.py`,
   `ports.ts`, `routes.tsx`, nav, public paths, plus every new file with the signatures below and
   `NotImplementedError` / placeholder bodies. After it, nobody touches the shared files again (except
   their owner, for bug fixes). So everyone can start at 0:10 without waiting for anyone.
3. **Code against the interfaces below, not against someone's implementation.** If an interface is wrong,
   say it out loud in the group; its owner changes it and announces the commit.
4. **Git**: everyone on `feat/transparency`. Small commits, `git pull --rebase` before each push. Since
   files don't overlap, rebases don't conflict. Never `--force`.
5. **Mock mode is the default** (`MOCK_AGENTS=1`). Only P2 needs the Gemini key until 1:30.
6. **Done = it works + its tests pass**: `cd backend && pytest` and `cd frontend && npm run typecheck`.

## Timeline

| Time | What |
|---|---|
| 0:00–0:10 | T000 skeleton pushed. Everyone reads this file and their brief, `git pull`. |
| 0:10–0:50 | Each one on their own phase 1. Frontend on the fake gateway; backend on mocks. |
| **0:50** | Sync 1 (5 min): P1's rules and P3's endpoints in mock mode are in. P4 and P5 switch `VITE_USE_FAKE` off. |
| 0:50–1:30 | Each one on their phase 2. |
| **1:30** | Sync 2 (10 min): run the demo end to end in mock mode, then with the real key. Bugs go to their file's owner. |
| **2:00** | Cut decision: chat (US4) and alert answers (US5) stay or go. From here, only fixes. |
| **2:20** | Code freeze. P5 leads 3 pitch rehearsals and the backup video; the others test on their phones. |

## The demo project (same numbers everywhere)

P2's mock agents, P3's seed and P4's fake gateway all use these values, so every screen tells the same story.

- **Project**: "Restauración de manglar en la Ciénaga Grande" — "Restauración de 5 ha de manglar en la
  Ciénaga Grande de Santa Marta: vivero, siembra, mantenimiento, monitoreo y talleres con la comunidad.
  Contrato con Corpamag por $180.000.000, 6 meses." `duration_weeks: 26`.
- **Budget**: contracting entity "Corpamag", contractor "Fundación Manglares Vivos", contract value
  `180000000`, start date `2026-08-03` (a Monday; end `2027-01-31`, inclusive). Today (2026-10-23) is week 12 of 26.

| id | name | amount |
|---|---|---|
| R1 | Plántulas de mangle | 45000000 |
| R2 | Mano de obra local | 70000000 |
| R3 | Logística y transporte fluvial | 30000000 |
| R4 | Monitoreo y talleres comunitarios | 35000000 |

- **Confirmed expenses in the seed**:
  1. Invoice, "Vivero Ciénaga Viva", 20.000 plántulas de *Rhizophora mangle*, `30000000`, `2026-08-20`,
     R1, task "Comprar plántulas". No alerts.
  2. Field photo, planting of the first hectare, no amount, `2026-09-15`, R2, task "Sembrar lote 1 (1 ha)". No alerts.
  3. Invoice, "Restaurante El Muelle", almuerzos, `2400000`, `2026-10-02`, charged to R1. AI alert
     `medium`: "El concepto (alimentación) no corresponde al rubro Plántulas de mangle. Requiere revisión."
- **Live demo files** (`backend/demo/`, P2): `factura-vivero.pdf` (fits R1), `factura-restaurante.jpg`
  (the mismatch), `foto-siembra.jpg` (field photo). The mock agent picks its answer by filename.

## Shared interfaces

### Backend — `app/domain/transparency.py` (owner: P1)

Shorthand below; in code, `import datetime as dt` and annotate `dt.date` / `dt.datetime`, because a
pydantic field named `date` can't also be annotated with the bare name `date`.

```python
ExpenseKind = Literal["invoice", "field_photo", "report"]
ExpenseStatus = Literal["draft", "confirmed"]
AlertLevel = Literal["high", "medium", "low"]
AlertSource = Literal["ai", "rule"]
Light = Literal["green", "yellow", "red"]

class BudgetLine(BaseModel):  id: str; name: str; amount: int
class Budget(BaseModel):
    project_id: int; contracting_entity: str; contractor: str; contract_value: int
    start_date: date; lines: list[BudgetLine]
def end_date(budget: Budget, duration_weeks: int) -> date          # the last day, inclusive: start + duration_weeks weeks - 1 day

class Alert(BaseModel):
    id: int | None = None; expense_id: int | None = None
    level: AlertLevel; reason: str; source: AlertSource
    answer: str | None = None; answered_at: datetime | None = None

class Expense(BaseModel):
    id: int | None = None; project_id: int; file_id: int; mime: str
    kind: ExpenseKind; status: ExpenseStatus = "draft"
    amount: int | None = None; date: date | None = None
    supplier: str | None = None; concept: str | None = None
    budget_line_id: str | None = None; task_id: int | None = None; task_title: str | None = None
    citizen_summary: str = ""; alerts: list[Alert] = []; created_at: datetime

class StoredFile(BaseModel):  id: int | None = None; project_id: int; name: str; mime: str; data: bytes

class ExpenseConfirmation(BaseModel):   # body of POST .../confirm
    kind: ExpenseKind; amount: int | None; date: date | None; supplier: str | None
    concept: str | None; budget_line_id: str | None; task_id: int | None; citizen_summary: str

# Agent outputs (output_schema)
class AlertDraft(BaseModel):  level: AlertLevel; reason: str
class EvidenceReading(BaseModel):
    kind: ExpenseKind; amount: int | None; date: date | None; supplier: str | None; concept: str | None
    budget_line_id: str | None; task_id: int | None; citizen_summary: str; alerts: list[AlertDraft]
class CitizenAnswer(BaseModel):  answer: str

# Computed (the Portal shape of plan.md)
class LineStatus(BaseModel):  id: str; name: str; amount: int; spent: int; available: int
class Summary(BaseModel):
    spent: int; spent_pct: float; physical_pct: float | None; time_pct: float
    unallocated: int; light: Light; reasons: list[str]
class TaskRef(BaseModel):  id: int; title: str
class WeekEntry(BaseModel):
    week_start: date; tasks_done: list[TaskRef]; spent: int; spent_pct_acc: float; physical_pct_acc: float
class SprintProgress(BaseModel):  name: str; goal: str; end_date: date | None; done_points: int; total_points: int
class PortalProject(BaseModel):
    name: str; description: str; contracting_entity: str; contractor: str
    contract_value: int; start_date: date; end_date: date
class Portal(BaseModel):
    project: PortalProject; summary: Summary; lines: list[LineStatus]; timeline: list[WeekEntry]
    sprints: list[SprintProgress]; expenses: list[Expense]; alerts: list[Alert]; public_url: str | None
class TeamPortal(Portal):  drafts: list[Expense]; public: bool

# Rules (pure; `expenses` = confirmed only; `today` is always passed in, never read from the clock)
def budget_errors(budget: Budget) -> list[FieldError]
def confirmation_errors(c: ExpenseConfirmation, budget: Budget, task_ids: set[int]) -> list[FieldError]
def line_status(budget: Budget, expenses: list[Expense]) -> list[LineStatus]
def summary(budget: Budget, end: date, expenses: list[Expense], tasks: list[Task], today: date) -> Summary
def traffic_light(spent_pct: float, physical_pct: float | None, time_pct: float, alerts: list[Alert]) -> tuple[Light, list[str]]
def weekly_timeline(budget: Budget, end: date, expenses: list[Expense], tasks: list[Task], today: date) -> list[WeekEntry]
def sprint_progress(sprints: list[Sprint], tasks: list[Task]) -> list[SprintProgress]
def rule_alerts(budget: Budget, end: date, confirmed: list[Expense], expense: Expense) -> list[AlertDraft]

# Errors (also here, so domain/errors.py isn't touched)
class ExpenseNotFound(NotFound) · AlertNotFound(NotFound) · FileNotFound(NotFound)
class BudgetMissing(DomainError): code = "budget_missing"
class ExpenseNotDraft(DomainError): code = "expense_not_draft"
class UnsupportedFile(DomainError): code = "unsupported_file"
class AgentUnavailable(DomainError): code = "agent_unavailable"
```

`Task` gets `done_at: datetime | None = None` (`app/domain/board.py`, P1): set by `reorder` when a task
enters `done`, cleared when it leaves.

### Backend — ports (`app/application/ports/`)

```python
# transparency_agents.py (owner: P2). Both raise AgentUnavailable on any failure.
class TransparencyAgents(Protocol):
    async def read_evidence(self, context: dict[str, Any], file: bytes, mime: str, filename: str) -> EvidenceReading: ...
    # context = {"budget": Budget, "contract_period": {"start", "end"}, "tasks": [{"id", "title", "sprint"}]}
    async def answer_citizen(self, portal: dict[str, Any], question: str) -> CitizenAnswer: ...

# repositories.py (owner: P3)
class BudgetRepository(Protocol):
    def get(self, project_id: int) -> Budget | None: ...
    def save(self, budget: Budget) -> Budget: ...                       # insert or replace
class ExpenseRepository(Protocol):                                     # an expense carries its alerts
    def get(self, expense_id: int) -> Expense | None: ...
    def list_by_project(self, project_id: int, status: ExpenseStatus | None = None) -> list[Expense]: ...
    def add(self, expense: Expense) -> Expense: ...
    def save(self, expense: Expense) -> Expense: ...                    # writes its alerts too, assigning ids
    def delete(self, expense_id: int) -> None: ...
    def get_alert(self, alert_id: int) -> Alert | None: ...
    def save_alert(self, alert: Alert) -> Alert: ...
class StoredFileRepository(Protocol):
    def add(self, file: StoredFile) -> StoredFile: ...
    def get(self, file_id: int) -> StoredFile | None: ...
# ProjectRepository gains: def get_by_public_slug(self, slug: str) -> Project | None
# UnitOfWork gains: budgets: BudgetRepository; expenses: ExpenseRepository; files: StoredFileRepository
# Project gains: public: bool = False; public_slug: str | None = None
```

### Backend — use cases (`app/application/use_cases/transparency/`)

| Class | Owner | `execute(...)` → |
|---|---|---|
| `GetBudget(uow)` | P3 | `(project_id) → Budget \| None` |
| `SetBudget(uow)` | P3 | `(project_id, budget) → Budget` |
| `DraftExpense(uow, agents)` | P3 | `(project_id, filename, mime, data) → Expense` |
| `ConfirmExpense(uow, today)` | **P1** | `(project_id, expense_id, ExpenseConfirmation) → Expense` |
| `DiscardExpense(uow)` | P3 | `(project_id, expense_id) → None` |
| `SetPublication(uow, public_app_url)` | P3 | `(project_id, public: bool) → (public, public_url)` |
| `GetPortal(uow, public_app_url, today)` | P3 | `.for_team(project_id) → TeamPortal`, `.for_public(slug) → Portal` |
| `AnswerAlert(uow)` | P3 | `(project_id, alert_id, answer) → Alert` |
| `AskCitizen(get_portal, agents)` | **P2** | `(slug, question) → CitizenAnswer` |

`today` is a `Callable[[], date]` injected from `main.py`, so tests fix the date.

### Frontend — `src/domain/transparency.ts` (owner: P4)

The same shapes as the Python models above and the API Contract, in camelCase-free snake_case like the
rest of `src/domain` (`budget_line_id`, `spent_pct`…). Types: `Budget`, `BudgetInput`, `BudgetLine`,
`Alert`, `Expense`, `ExpenseConfirmation`, `LineStatus`, `Summary`, `WeekEntry`, `SprintProgress`,
`Portal`, `TeamPortal`, `Publication = { public: boolean; public_url: string | null }`, `CitizenAnswer`.

### Frontend — `src/application/ports.ts` (owner: P4)

```ts
export interface TransparencyGateway {
  getBudget(projectId: number): Promise<Budget | null>
  setBudget(projectId: number, body: BudgetInput): Promise<Budget>
  uploadEvidence(projectId: number, file: File): Promise<Expense>
  confirmExpense(projectId: number, expenseId: number, body: ExpenseConfirmation): Promise<Expense>
  discardExpense(projectId: number, expenseId: number): Promise<void>
  getTeamPortal(projectId: number): Promise<TeamPortal>
  setPublication(projectId: number, isPublic: boolean): Promise<Publication>
  answerAlert(projectId: number, alertId: number, answer: string): Promise<Alert>
}
export interface PublicPortalGateway {
  getPortal(slug: string): Promise<Portal>
  ask(slug: string, question: string): Promise<CitizenAnswer>
}
// Gateways gains: transparency: TransparencyGateway; publicPortal: PublicPortalGateway
```

### Frontend — read-only components (`src/ui/components/transparency/`, owner: P5)

P4 reuses them in the team tab. Props are fixed by the skeleton:

```ts
TrafficLight({ summary }: { summary: Summary })
ProgressBars({ summary }: { summary: Summary })          // spent, physical, time
BudgetLines({ lines }: { lines: LineStatus[] })
WeeklyTimeline({ timeline }: { timeline: WeekEntry[] })
EvidenceList({ expenses }: { expenses: Expense[] })
AlertList({ alerts, onAnswer }: { alerts: Alert[]; onAnswer?: (alertId: number, answer: string) => void })
CitizenChat({ slug }: { slug: string })
```

Routes (skeleton): `/projects/:projectId/transparency` → `TransparencyPage` (P4), `/p/:slug` →
`PublicPortalPage` (P5, public path, no session).
