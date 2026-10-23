# Implementation Plan: Public transparency portal

**Date**: 2026-10-23  
**Spec**: [spec.md](spec.md)  
**Status**: Approved

## Summary

A `transparency` feature on top of the existing project manager. A project gets a budget; members upload
evidence that Gemini reads into expense drafts (with alerts) and a person confirms; rules compute the
numbers, the traffic light and a weekly timeline from the board's tasks and the confirmed expenses; and
a public, phone-first portal at `/p/{slug}` shows it all, with a chat. The planning agents' prompts are
generalized to any kind of project. GitHub and generated documents are hidden.

Time box: 3 hours, 5 people. Phases 1–6 are the demo; phase 7 (chat) and phase 8 (alert answers) are cut
in that order if time runs out.

## Technical Context

**Language/Version**: Python 3.13; TypeScript 6 + React 19  
**Primary Dependencies**: FastAPI, SQLModel, Google ADK + Gemini (`gemini-3.5-flash`, reads PDFs and
images); new on the frontend: `qrcode`  
**Storage**: SQLite; uploaded files as bytes in their own table  
**Testing**: pytest (rules + API); vitest where it's cheap  
**Target Platform**: a deployment the jury's phones reach over the internet (not run by this team)  
**Constraints**: 3 hours; must work in mock mode with the seeded project

### Decisions

- **D1 — Stay on this stack** (not Firebase/Firestore): accounts, permissions, board, Gemini with
  `output_schema` and mock mode already work.
- **D2 — The evidence and chat agents run inside the request** (one Gemini call, 5–20 s, spinner).
  Exception to plan/api-conventions.md ("agents never run inside the request"), written there.
- **D3 — Uploads are `multipart/form-data`** (field `file`): PDF, JPEG, PNG or WebP up to 10 MB, else
  `422 unsupported_file`. The other exception to the JSON-only rule.
- **D4 — Files as bytes in SQLite** (`stored_file` table), served by id.
- **D5 — Physical progress = done points / all points** of the project's tasks (the board already has
  points). Needs **`Task.done_at`**: set when a task enters `done`, cleared when it leaves, in
  `move_task` and `update_task`. New column → the demo DB is recreated (`rm agile.db && python -m app.seed`).
- **D6 — Rules in `domain/transparency.py`** as pure functions: `budget_summary`, `traffic_light`
  (FR-008, reasons as Spanish strings — UI text), `weekly_timeline` (FR-009), `rule_alerts` (FR-005).
  They are the credibility claim, so they get unit tests first.
- **D7 — New port `TransparencyAgents`**: `read_evidence(budget, tasks, file, mime) → EvidenceReading`,
  `answer_citizen(portal, question) → CitizenAnswer`. ADK adapter: an `LlmAgent` per call with
  `output_schema`, the file as `types.Part.from_bytes`. Mock adapter: picks a fixture by filename
  (`restaurante` → the mismatch alert, `foto` → field photo, else the seedlings invoice).
- **D8 — Generalize the planning prompts** (`adk/prompts.py`: "plans software projects" → "plans
  projects of any kind: software, field work, environmental, social…", roles and tasks from the
  description). The mock planning data stays software; the demo project comes from the seed (D11).
- **D9 — Publication**: `Project.public_slug` (`secrets.token_urlsafe(8)`, generated on first publish,
  kept on unpublish) and `Project.public: bool`. The QR encodes `{PUBLIC_APP_URL}/p/{slug}` (env var,
  falls back to the current origin).
- **D10 — Public exposure**: the app is deployed by someone outside this team; no tunnel. What the deployment
  needs: the portal (`apps/portal`, a static build) and the backend under one origin, with `/api` proxied to
  the backend (the portal calls `/api` relative), and `PUBLIC_APP_URL` set to the portal's public origin so
  the QR points at it.
- **D11 — The seed builds the demo project directly** (planned mangrove board with tasks done across
  past weeks, budget, 3 confirmed expenses, portal published), without running the agents.
- **D12 — Alerts can't be cleared by the executing entity** (spec US5): it only answers; answered alerts
  still count in the traffic light.
- **D13 — Hide, don't delete**: GitHub integration and documents leave the navigation; a
  `GENERATE_DOCUMENTS` flag (off) keeps `wire_documents` out of `on_plan_completed`, and the issue
  proposals follow-up is skipped while `MOCK_GITHUB`. Their code, routers and tests stay.
- **D14 — Fake frontend gateway** with the API Contract's mangrove fixture, so both frontend people start
  at 0:00.
- **D15 — Permissions (spec 015)**: budget, publication and alert answers need a leader (`403 forbidden`);
  uploading and confirming evidence needs a member. Public endpoints need nothing.
- **D16 — US7, quick version**: the contract fills the project and its budget; the planning pipeline
  doesn't change. Storing the contract as structured data for the agents and aligning sprint dates to the
  milestones are left for after the hackathon.
- **D17 — The agents see the contract through the description**: the backend composes it in code from the
  purpose, the obligations and the milestones with their dates ("Hitos del contrato: … (antes del
  2026-09-30)"), within the 5,000 characters of `DESCRIPTION_MAX`, cutting the obligations first. The
  leader can edit it in the draft. The planning prompts get one line (P2's `prompts.py`): "If the
  description lists contract milestones, plan each one before its date."
- **D18 — Its own port, `ContractReader`** (`read(file, mime) → ContractReading`), apart from P2's
  `TransparencyAgents`, so nobody shares a file. Same ADK pattern (file as `Part.from_bytes`, an
  `output_schema`), same mock switch.
- **D19 — No team from the contract** (FR-019): `ContractReading` has no people or roles; the creator is
  the only member, as in `POST /api/projects`.
- **D20 — The duration follows from the dates** in code: `ceil((end - start + 1 day) / 7)` weeks, within
  `WEEKS_RANGE` (1–52); the budget's start date is the contract's start date.

## Project Structure

```text
apps/api/app/
  domain/transparency.py                     entities, agent output schemas, rules (D6), errors
  domain/board.py                            + Task.done_at (D5)
  domain/project.py                          + public, public_slug (D9)
  application/ports/transparency_agents.py   TransparencyAgents (D7)
  application/ports/repositories.py          + BudgetRepository, ExpenseRepository, StoredFileRepository
  application/ports/unit_of_work.py          + budgets, expenses, files
  application/use_cases/board/move_task.py, update_task.py   done_at
  application/use_cases/transparency/
    get_budget.py  set_budget.py  draft_expense.py  confirm_expense.py  discard_expense.py
    set_publication.py  get_portal.py  answer_alert.py  ask_citizen.py
  adapters/outbound/agents/adk/transparency_agents.py, transparency_prompts.py, prompts.py (D8)
  adapters/outbound/agents/mock/transparency_agents.py, transparency_data.py
  adapters/outbound/persistence/             + tables, mappers, repos
  adapters/inbound/http/transparency.py      private endpoints
  adapters/inbound/http/public.py            public endpoints
  main.py, config.py                         wiring, GENERATE_DOCUMENTS, PUBLIC_APP_URL (D13, D9)
  seed.py                                    the mangrove project (D11)
apps/api/demo/                                invoices and a field photo for the live demo
apps/api/tests/unit/domain/test_transparency.py
apps/api/tests/integration/adapters/test_transparency_api.py

packages/domain/src/                       (@agile/domain, spec 018)
  transparency.ts                            types mirroring domain/transparency.py
  fixtures/demoTransparency.ts               the mangrove fixture (D14), shared by both apps
packages/ui/src/transparency/                (@agile/ui/transparency) TrafficLight, ProgressBars,
                                             WeeklyTimeline, BudgetLines, EvidenceList, AlertList, CitizenChat
apps/portal/src/                             the public portal app, :5174 (spec 018)
  ui/pages/PublicPortalPage.tsx              /p/:slug, phone first
  application/ports.ts, adapters/            PublicPortalGateway (http + fake)
apps/team/src/
  application/ports.ts                       + TransparencyGateway
  application/use-cases/useTransparency.ts
  adapters/http/transparencyGateway.ts, adapters/fake/transparencyGateway.ts (D14)
  ui/pages/TransparencyPage.tsx              project tab "Transparencia": budget, expenses, alerts, publish + QR
  ui/components/transparency/                QrCard and the forms
```

**Structure Decision**: same hexagonal layout as every other feature; `tests/architecture/test_layers.py`
keeps passing because nothing in `domain/` or `application/` imports ADK, FastAPI or SQLModel.

## API Contract

New domain errors (added to plan/api-conventions.md): `ExpenseNotFound` → 404 `expense_not_found`,
`AlertNotFound` → 404 `alert_not_found`, `FileNotFound` → 404 `file_not_found`, `BudgetMissing` → 409
`budget_missing`, `ExpenseNotDraft` → 409 `expense_not_draft`, `UnsupportedFile` → 422
`unsupported_file`, `AgentUnavailable` → 502 `agent_unavailable` (Gemini failed or returned something
that doesn't validate; nothing is saved).

Private endpoints: `401 not_authenticated`, `404 project_not_found` for non-members (spec 015), `403
forbidden` where D15 asks for a leader. Not repeated in each table.

### Shared shapes

**Budget** `{ "contracting_entity": "Corpamag", "contractor": "Fundación Manglares Vivos", "contract_value": 180000000, "start_date": "2026-05-01", "end_date": "2026-10-30", "lines": [BudgetLine] }` — `end_date` is computed (read only).

**BudgetLine** `{ "id": "R1", "name": "Plántulas de mangle", "amount": 45000000 }`

**Alert** `{ "id": 3, "level": "high|medium|low", "reason": "…", "source": "ai|rule", "answer": null, "answered_at": null }`

**Expense** `{ "id": 7, "kind": "invoice|field_photo|report", "status": "draft|confirmed", "file_url": "/api/files/12", "mime": "image/jpeg", "amount": 1850000, "date": "2026-07-02", "supplier": "Vivero El Puerto", "concept": "…", "budget_line_id": "R1", "task_id": 41, "task_title": "Comprar plántulas", "citizen_summary": "…", "alerts": [Alert], "created_at": "…" }` — `amount` is `null` for photos.

**Portal** (everything computed by rules except the texts the AI wrote and a person confirmed)

```json
{
  "project": { "name": "…", "description": "…", "contracting_entity": "…", "contractor": "…",
               "contract_value": 180000000, "start_date": "…", "end_date": "…" },
  "summary": { "spent": 72000000, "spent_pct": 40.0, "physical_pct": 25.0, "time_pct": 46.2,
               "unallocated": 0, "light": "green|yellow|red",
               "reasons": ["Se ha gastado 15 puntos más de lo que se ha avanzado"] },
  "lines": [{ "id": "R1", "name": "…", "amount": 45000000, "spent": 30000000, "available": 15000000 }],
  "timeline": [{ "week_start": "2026-05-04", "tasks_done": [{ "id": 41, "title": "…" }], "spent": 1850000,
                 "spent_pct_acc": 1.0, "physical_pct_acc": 4.0 }],
  "sprints": [{ "name": "…", "goal": "…", "end_date": "…", "done_points": 8, "total_points": 13 }],
  "expenses": [Expense],
  "alerts": [Alert & { "expense_id": 7 }],
  "public_url": "https://…/p/Xk3…"
}
```

`expenses` newest first, only confirmed ones in the public endpoint. `physical_pct` is `null` when there
are no tasks.

### `GET /api/projects/{id}/budget` — read (US1)

`200` → `Budget`, or `null` if it hasn't been set.

### `PUT /api/projects/{id}/budget` — set (US1, leader)

Body: `Budget` without `end_date`. `contract_value` > 0; each line `amount` ≥ 0 and `name` 1–120 chars;
line ids unique (the client sends `R1…`, the server keeps them).

| Status | When | Body |
|---|---|---|
| `200` | Saved | `Budget` |
| `422` | Rules above | `validation_failed` with `errors` |

### `POST /api/projects/{id}/expenses` — read evidence into a draft (US2, member)

`multipart/form-data`, field `file`. Runs the evidence agent inside the request (D2).

| Status | When | Body |
|---|---|---|
| `201` | Draft created with the AI's alerts | `Expense` (`status: draft`) |
| `409` | The project has no budget | `budget_missing` |
| `422` | Missing file, wrong type, > 10 MB | `unsupported_file` |
| `502` | The agent failed | `agent_unavailable` |

### `POST /api/projects/{id}/expenses/{expenseId}/confirm` — confirm (US2, member)

Body: `{ "kind", "amount", "date", "supplier", "concept", "budget_line_id", "task_id", "citizen_summary" }`.
`amount` ≥ 0 or `null`; `budget_line_id` and `task_id` must exist or be `null`; `citizen_summary` 1–200
chars. Adds the rule alerts (FR-005).

| Status | When | Body |
|---|---|---|
| `200` | Confirmed | `Expense` |
| `404` | Unknown expense | `expense_not_found` |
| `409` | Already confirmed | `expense_not_draft` |
| `422` | Rules above | `validation_failed` |

### `DELETE /api/projects/{id}/expenses/{expenseId}` — discard a draft (US2, member)

`204` · `404 expense_not_found` · `409 expense_not_draft` (confirmed expenses can't be deleted).

### `GET /api/projects/{id}/transparency` — the team's view (US2, US3, US5)

`200` → `Portal` plus `"drafts": [Expense]`, `"public": true|false`; `409 budget_missing`.

### `PUT /api/projects/{id}/publication` — publish or unpublish (US3, leader)

Body `{ "public": true }`. `200` → `{ "public": true, "public_url": "…" }` · `409 budget_missing`.

### `POST /api/projects/{id}/alerts/{alertId}/answer` — answer an alert (US5, leader)

Body `{ "answer": "…" }` (1–500 chars). `200` → `Alert` · `404 alert_not_found` · `422 validation_failed`.

### `GET /api/files/{fileId}` — a stored file (US2, US3)

Members of its project, or anyone if it belongs to a confirmed expense of a published project. `200`
with the file's own `Content-Type` · `404 file_not_found`.

### `GET /api/public/projects/{slug}` — the portal (US3)

`200` → `Portal` · `404 project_not_found` (unknown slug or unpublished).

### `GET /api/public/projects?q=` — search the published projects (US8)

`q` optional (0–100 chars), matched against name, description, contracting entity and contractor, ignoring
case and accents. Only published projects, by name.

`200` → `[PublicProjectCard]`:
`{ "slug": "Xk3…", "name": "…", "description": "…", "contracting_entity": "Corpamag", "contractor": "…", "contract_value": 180000000, "start_date": "…", "end_date": "…", "light": "yellow", "spent_pct": 18.0, "physical_pct": 22.2, "time_pct": 44.5, "open_alerts": 1 }`

### `POST /api/public/projects/{slug}/ask` — citizen chat (US4)

Body `{ "question": "…" }` (1–300 chars). `200` → `{ "answer": "…" }` · `404 project_not_found` ·
`422 validation_failed` · `502 agent_unavailable`.

### `POST /api/contracts/read` — read a contract into a project draft (US7)

Session required. `multipart/form-data`, field `file`: a PDF up to 10 MB. Runs the contract agent inside
the request (D2). Nothing is saved.

**ContractReading**

```json
{ "name": "Restauración de manglar en la Ciénaga Grande", "purpose": "…",
  "contracting_entity": "Corpamag", "contractor": "Fundación Manglares Vivos",
  "contract_value": 180000000, "start_date": "2026-08-03", "end_date": "2027-01-31",
  "duration_weeks": 26,
  "lines": [{ "id": "R1", "name": "Plántulas de mangle", "amount": 45000000 }],
  "obligations": ["Instalar un vivero de 20.000 plántulas", "…"],
  "milestones": [{ "name": "Vivero instalado", "date": "2026-09-30", "deliverable": "Informe con fotos" }],
  "description": "…" }
```

Any field may be `null` (or an empty list) when the contract doesn't state it; `duration_weeks` and
`description` are computed by the backend (D17, D20), not by the AI.

| Status | When | Body |
|---|---|---|
| `200` | Read | `ContractReading` |
| `422` | Missing file, not a PDF, > 10 MB | `unsupported_file` |
| `502` | The agent failed | `agent_unavailable` |

### `POST /api/projects/from-contract` — create the project and its budget (US7)

Session required. Body: `{ "name", "description", "duration_weeks", "requested_methodology",
"auto_approve", "role", "budget": BudgetInput }`, the project fields as in `POST /api/projects` and
`budget` as in `PUT /api/projects/{id}/budget`. Project and budget are saved in one commit (FR-020).

| Status | When | Body |
|---|---|---|
| `201` | Created, the caller as its leader | `Project` + `Location` |
| `422` | The project's or the budget's rules (`budget.lines[1].amount`…) | `validation_failed` with `errors` |

---

## What we cut from the existing product

Hidden, not deleted (D13): no time to fix what a deletion breaks, and nothing hidden is in the demo's path.

| Keep (the executing entity uses it) | Hide from navigation, and stop it from running |
|---|---|
| Accounts, sign in, team and invitations, roles (leader/member) | GitHub integration, webhooks, issue proposals |
| Planning with the agents (prompts generalized, D8), proposals | Generated specs and diagrams (Documents) |
| Board, sprints, plan views, replanning on team or sprint changes | |
| Design system, shell, mock mode, seed | |

## Team split (5 people)

Owners are by file, so nobody edits someone else's file. Each person's brief: [team/](team/README.md). Everyone works on `feat/transparency` with small
commits and `git pull --rebase` often. The **API Contract** above is frozen at 0:10; whoever needs to change
it says so out loud first.

| Who | Owns | Tasks | Files |
|---|---|---|---|
| **P1 — Rules** | Every number, the traffic light and the timeline | T003, T004, T005, T006, T014 | `domain/transparency.py`, `domain/board.py` (done_at), `board/move_task.py`, `board/update_task.py`, `test_transparency.py`, `transparency/confirm_expense.py` |
| **P2 — AI** | The evidence and chat prompts and adapters; generalized planning prompts; demo files | T002, T007, T009, T010, T021 | `ports/transparency_agents.py`, `agents/adk/*`, `agents/mock/transparency_*`, `transparency/ask_citizen.py`, `apps/api/demo/` |
| **P3 — API** | Persistence, use cases, endpoints, cuts in the backend, seed | T008, T011–T013, T015, T018, T019, T023 | `ports/repositories.py`, `ports/unit_of_work.py`, `persistence/*`, `domain/project.py`, the other `transparency/*`, `http/transparency.py`, `http/public.py`, `main.py`, `config.py`, `seed.py` |
| **P4 — Team UI** | The "Transparencia" tab and the cuts in navigation | T001 (frontend), T016, T017, T024 | `@agile/domain` (types, fixture), `ports.ts`, `adapters/*/transparencyGateway.ts`, `useTransparency.ts`, `TransparencyPage`, `QrCard`, `routes.tsx`, project nav |
| **P5 — Portal + demo** | What the jury sees on their phone; deployment notes, pitch | T020, T022, T025–T027, pitch + backup video | `apps/portal/*`, `packages/ui/src/transparency/*`, docs |
| **Claude — US7** | The project from the contract | T028–T033 | In `apps/api`: `domain/contracts.py`, `ports/contract_reader.py`, `agents/*/contract_reader.py`, `use_cases/contracts/*`, `http/contracts.py`, `demo/contrato-manglar.pdf`. In `apps/team`: `domain/contracts.ts`, `adapters/*/contractGateway.ts`, `useContracts.ts`, `NewProjectFromContractPage.tsx`. One line each in `main.py` (P3), `routes.tsx` and `ports.ts` (P4), and in `prompts.py` (P2), announced first |

P4 owns `QrCard` and the forms in `apps/team`; P5 owns `apps/portal` and the read-only components in
`packages/ui/src/transparency/` (the team tab reuses P5's `TrafficLight`, `ProgressBars`, `BudgetLines`).

Sync points:

- **0:10** — everyone has read the API Contract; P1 pushes the entities and schemas (T003) first, since P2
  and P3 import them.
- **0:50** — rules with tests (P1), endpoints in mock mode (P3); P4 and P5 switch from fake to http.
- **1:30** — integration: the demo end to end in mock mode, then with the real key.
- **2:00** — cut decision (phases 7–8). From here, only fixes.
- **2:20** — code freeze: P5 leads 3 pitch rehearsals and records the backup video; the rest test on phones.

## Phase 1: Setup (~10 min)

- [x] T000 Skeleton commit: every shared file and every new file with the team README's signatures (team/README.md)
- [ ] T001 `qrcode` on the frontend; `PUBLIC_APP_URL` (backend) and `VITE_PUBLIC_APP_URL` (frontend)
- [ ] T002 Demo files in `apps/api/demo/`: a seedlings invoice, a restaurant invoice, a field photo of planting

## Phase 2: Foundational (~40 min)

- [x] T003 `domain/transparency.py`: Budget, BudgetLine, Expense, Alert, agent output schemas
  (EvidenceReading, CitizenAnswer), errors
- [x] T004 `Task.done_at`, set and cleared in `move_task` and `update_task` (D5)
- [x] T005 Rules: `budget_summary`, `traffic_light` with reasons, `weekly_timeline`, `rule_alerts`
- [x] T006 Unit tests: the spec's 40%/25% case, each red and yellow trigger, no tasks, overspend, line
  overspend, date outside the period, a week with tasks and no spending, answered alerts still counting
- [ ] T007 Port `TransparencyAgents`
- [ ] T008 Repository ports, UoW members, persistence (budget lines as a JSON column, expense, alert,
  stored_file), `Project.public` / `public_slug`
- [ ] T009 Mock and ADK adapters with the evidence and chat prompts (D7), wired in `main.py`

**Checkpoint**: rules tested; agents callable in mock and real mode.

## Phase 3: US6 — Plans for any kind of project (~15 min, in parallel)

- [ ] T010 [US6] Generalize `adk/prompts.py` (D8); plan the mangrove description with the real key and check
  the board has no software tasks or roles

## Phase 4: US1 — Project budget (~20 min)

- [ ] T011 [US1] Use cases `get_budget`, `set_budget` + endpoints + API tests
- [ ] T016 [US1] Frontend: types, gateways (fake + http), hooks; "Transparencia" tab in the project nav
  with the budget editor (lines, sum against the value, "sin asignar")

## Phase 5: US2 — Expenses with evidence (~35 min)

- [ ] T012 [US2] Use cases `draft_expense`, `discard_expense`; file storage and `GET /api/files/{id}`
- [x] T014 [US2] Use case `confirm_expense` (rule alerts)
- [ ] T013 [US2] Endpoints + API tests for every status row
- [ ] T017 [US2] Upload with spinner → draft review form (task picker from the board) → confirm or discard;
  alerts with their source (IA / regla)

**Checkpoint**: the team can register money against activities.

## Phase 6: US3 — Public portal by QR (~35 min)

- [ ] T015 [US3] Use cases `get_portal`, `set_publication` + `transparency.py` and `public.py` endpoints + tests
- [ ] T018 [US3] Seed the mangrove project (D11): planned board, tasks done across past weeks, budget,
  3 confirmed expenses (one with the restaurant alert), portal published
- [ ] T020 [US3] `PublicPortalPage` at `/p/:slug` in `apps/portal`: parties, traffic light + reasons, three
  bars, weekly timeline (activities and money per week, accumulated lines), budget lines, evidence with
  photos, alerts with answers; phone first
- [ ] T024 [US3] Publish toggle + `QrCard` on the Transparencia tab

**Checkpoint**: the demo works. Everything after this is optional.

## Phase 7: US4 — Citizen chat (~15 min, first to cut)

- [ ] T021 [US4] Use case `ask_citizen` (sends only the portal's data) + endpoint + test
- [ ] T022 [US4] `CitizenChat` on the portal, with 3 suggested questions

## Phase 8: US5 — Answer alerts (~10 min, second to cut)

- [ ] T019 [US5] Use case `answer_alert` + endpoint + test
- [ ] (P4) "Responder" on each alert in the Transparencia tab; the portal shows the answer

## Phase 8b: US7 — The project starts from the contract (~50 min, Claude, in parallel)

- [ ] T028 [US7] `domain/contracts.py`: `ContractReading` (agent output) and the rules
  `duration_weeks(start, end)` and `compose_description(reading)` (D17, D20), with unit tests
- [ ] T029 [US7] Port `ContractReader`; mock adapter (the mangrove contract of the team README) and ADK
  adapter with the contract prompt (FR-018, FR-019: no people, no invented amounts)
- [ ] T030 [US7] Use cases `ReadContract` and `CreateProjectFromContract` (project + budget in one commit,
  reusing `CreateProject`'s rules and P1's `budget_errors`) + `http/contracts.py` + API tests
- [ ] T031 [US7] Frontend: `ContractGateway` (http + fake), `useContracts`, `NewProjectFromContractPage`
  (upload with spinner → editable draft: project fields, budget lines, obligations and milestones as a
  read-only preview of the description → "Crear proyecto"); a "Crear desde contrato" entry on the new
  project screen
- [ ] T032 [US7] `apps/api/demo/contrato-manglar.pdf`: 2 pages, the numbers of the team README
- [ ] T033 [US7] The milestones line in the planning prompts (D17, with P2); plan the demo contract's
  project with the real key and check every milestone lands before its date

## Phase 8c: US8 — Find a public project (P5)

- [x] T028 [US8] Use case `search_public_projects` (reuses `GetPortal.for_public`) + `GET /api/public/projects` + test
- [x] T029 [US8] Portal home `/`: search, light filter, result cards opening `/p/:slug`
- [x] T030 [US8] Portal frame like the team app: top bar (brand, Proyectos, Cómo funciona, theme, "Soy ejecutor" to the
  team app's sign in via `VITE_TEAM_APP_URL`), footer with the legal frame, and a `/como-funciona` page
- [x] T031 [US8] Home like the team app's (spec 016): the living gradient hero with search, suggestions and a live
  preview of a published project, the projects panel over it, then what you see, how it works, who it's for,
  questions and a call to executing entities

## Phase 9: Polish & demo (~20 min)

- [ ] T023 Cuts in the backend (D13): `GENERATE_DOCUMENTS` flag, skip issue proposals; hide GitHub and
  Documents from the nav (P4)
- [ ] T025 plan/api-conventions.md (D2, D3 and new errors), apps/team/docs/api-contract.md, plan/context.md
  and README updated to the transparency module
- [ ] T026 Deployment notes for whoever deploys (D10); QR tested from a real phone on mobile data once deployed
- [ ] T027 Full demo with the real key and in mock mode; `pytest`, `npm run typecheck`, `npm run lint`

## Dependencies & Execution Order

- Phase 2 blocks everything except T010 (US6) and the frontend on the fake gateway.
- US1 → US2 → US3 (each needs the previous one's data); US4 and US5 only need US3.
- If at 2:00 phase 6 isn't done: skip phases 7–8, go straight to T018 and T026.
- US7 (phase 8b) only needs P1's `budget_errors` (done) and the existing `CreateProject`; it runs in
  parallel with everything. If it isn't working by 2:00, the demo starts from the seeded project.
