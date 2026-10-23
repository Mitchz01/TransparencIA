# Implementation Plan: 003 · Kanban board and sprints

**Date**: 2026-10-23  
**Spec**: [spec.md](spec.md)  
**Status**: Approved

## Summary

Turn the approved plan into a board and let the team work on it. Backend: a pure `build_board()` in the domain turns the approved backlog and sprint planning into sprints, objectives and tasks (assignment by name, then by role with the fewest points, else flagged with the missing role; checklist from the acceptance criteria); `ApplyPlan` persists it idempotently and is registered as a plan-completed handler of spec 002. Board use cases move, edit and update the checklist of tasks, warn about WIP limits and sprint overload without blocking, and publish activity events. Frontend: a dnd-kit board with optimistic moves, a sprint selector with capacity bars, a task drawer with the checklist, filters, and a continuous mode for Kanban.

## Technical Context

**Language/Version**: Python 3.13 (backend), TypeScript 6 + React 19 (frontend)  
**Primary Dependencies**: FastAPI, Pydantic, SQLModel; `@dnd-kit/core` + `@dnd-kit/sortable`, React Router, Tailwind  
**Storage**: SQLite; existing `sprint` and `task` tables (+ `missing_role`), new `objective` table, `sprint_capacity_override` on `project`  
**Testing**: pytest (pure domain tests for the board builder, use cases with `InMemoryUnitOfWork`, API with TestClient); `tsc -b`  
**Target Platform**: local dev server, Cloud Run as the deployment target  
**Project Type**: web (backend + frontend)  
**Performance Goals**: board appears < 5 s after approving sprints (SC-001); moves feel instant (optimistic update, SC-004)  
**Constraints**: WIP and capacity only warn, never block (constitution 4); capacity uses `domain/capacity.py` from spec 002; hexagonal dependency rule  
**Scale/Scope**: up to ~100 tasks and ~10 sprints per project

## Project Structure

### Documentation (this feature)

```text
specs/003-kanban-board/
├── plan.md              # This file
└── spec.md              # Feature spec
```

### Source Code (repository root)

```text
backend/app/
├── domain/
│   ├── board.py                         # + Objective, missing_role, build_board(), assign(), reorder(), wip_warnings()
│   ├── project.py                       # + sprint_capacity_override
│   └── events.py                        # + PlanApplied, TaskUpdated
├── application/
│   ├── dto.py                           # + BoardView, SprintLoad, TaskMove, TaskEdit, ChecklistUpdate
│   ├── ports/repositories.py            # + SprintRepository.get/save, ObjectiveRepository
│   ├── ports/unit_of_work.py            # + objectives
│   └── use_cases/
│       ├── planning/apply_plan.py
│       └── board/get_board.py, move_task.py, update_task.py, update_checklist.py, set_capacity.py
└── adapters/
    ├── inbound/http/board.py            # /api/projects/{id}/board, /api/tasks/{id}
    └── outbound/persistence/            # ObjectiveTable, Task.missing_role, repos, UoW

backend/tests/
├── unit/domain/test_board_builder.py, test_board_rules.py
├── unit/application/test_apply_plan.py, test_move_task.py, test_update_task.py
└── integration/adapters/test_board_api.py

frontend/src/
├── domain/board.ts, rules.ts            # + Objective, BoardView, wipWarnings, checklistProgress, sprintLoad
├── application/ports.ts                 # + BoardGateway
├── application/use-cases/useBoard.ts, useTaskEditor.ts
├── adapters/http/boardGateway.ts, adapters/fake/boardGateway.ts
└── ui/
    ├── pages/BoardPage.tsx
    └── components/board/KanbanBoard.tsx, Column.tsx, TaskCard.tsx, TaskDrawer.tsx,
                         Checklist.tsx, SprintSelector.tsx, CapacityBar.tsx, BoardFilters.tsx
```

**Structure Decision**: web application on the existing hexagonal layout. The board-building logic is a pure function in `domain/board.py` so it can be tested without a DB; `ApplyPlan` only orchestrates persistence.

## API Contract

Follows [plan/api-conventions.md](../../plan/api-conventions.md) (headers, error body, status codes). The API tests assert every status row below.

New domain errors (Foundational): `CapacityNotApplicable`; `SprintClosed` once spec 008 adds closed sprints.

### Shared shapes

**Task**

```json
{
  "id": 87,
  "project_id": 12,
  "sprint_id": 5,
  "assignee_id": 3,
  "key": "US-4",
  "epic_key": "EP-2",
  "title": "Load members and roles",
  "description": "As a leader I want…",
  "acceptance_criteria": ["Works on desktop and mobile"],
  "checklist": [{ "text": "Works on desktop and mobile", "done": false }],
  "type": "feature",
  "points": 3,
  "priority": "high",
  "status": "todo",
  "position": 0,
  "missing_role": null
}
```

- `status`: `backlog` | `todo` | `in_progress` | `review` | `done`. `type`: `feature` | `bug` | `chore` | `spike`. `priority`: `low` | `medium` | `high`.
- `sprint_id: null` = in the backlog. `assignee_id: null` with `missing_role: "UX design"` = nobody covers the role.
- Spec 007 adds `issue: {"number", "url", "state", "broken"} | null`.

**Warning** (never blocks, returned next to the task)

```json
{ "code": "wip_limit_exceeded", "column": "in_progress", "limit": 3, "count": 4 }
```

`code`: `wip_limit_exceeded` | `sprint_overloaded` (`{"code", "sprint_id", "points", "capacity"}`).

### `GET /api/projects/{id}/board` — board read model (Foundational, US1, US4)

| Status | When | Body |
|---|---|---|
| `200` | Exists (empty lists until the plan is applied) | `BoardView` |
| `404` | Unknown project | Error `project_not_found` |

```json
{
  "project_id": 12,
  "continuous": false,
  "wip_limits": [{ "column": "in_progress", "limit": 3 }],
  "capacity_override": null,
  "sprints": [
    {
      "id": 5, "number": 1, "name": "Sprint 1", "goal": "Base ready", "phase": "Foundations",
      "load": { "points": 21, "capacity": 18, "overloaded": true }
    }
  ],
  "objectives": [{ "id": 9, "sprint_id": 5, "title": "Base ready", "done": false }],
  "tasks": [ /* Task */ ]
}
```

`continuous: true` when the methodology is Kanban: no sprint selector and `load` is `null` (spec edge case).

### `PATCH /api/tasks/{id}` — move or edit a task (US2, US3, US4)

Request headers: `Content-Type: application/json`. Every field is optional; at least one is required. Move fields and edit fields can be combined.

```json
{
  "status": "in_progress",
  "position": 0,
  "sprint_id": 6,
  "title": "Load members and roles",
  "description": "…",
  "points": 5,
  "priority": "high",
  "assignee_id": 3
}
```

- **Move**: `status`, `position` (0-based index in the target column; positions are compacted), `sprint_id` (`null` = backlog). Moving to another sprint without `status` lands in `todo`.
- **Edit**: `title`, `description`, `points`, `priority`, `assignee_id` (`null` = unassigned). Assigning someone clears `missing_role`.

| Status | When | Body |
|---|---|---|
| `200` | Saved; publishes `task_status_changed` (move) or `task_updated` (edit) | `{"task": Task, "warnings": [Warning], "suggest_advance": false}` |
| `400` | Body isn't JSON | Error `malformed_request` |
| `404` | Unknown task | Error `task_not_found` |
| `409` | Target sprint is closed (spec 008) | Error `sprint_closed` |
| `422` | Empty body; `status` or `priority` not in the enum; `position` < 0; `points` not an integer 0–100; `title` empty or > 200 chars; `sprint_id` or `assignee_id` not from this project. Nothing is saved | Error `validation_failed` with `errors` |

Going over a WIP limit or the sprint capacity returns `200` with a warning, never an error (constitution, principle 4).

### `PUT /api/tasks/{id}/checklist` — replace the checklist (US3)

Request headers: `Content-Type: application/json`

```json
{ "items": [{ "text": "Form validates fields", "done": true }, { "text": "Has tests", "done": false }] }
```

| Status | When | Body |
|---|---|---|
| `200` | Saved; publishes `task_updated` | `{"task": Task, "warnings": [], "suggest_advance": true}` — `suggest_advance` is `true` when every item is done and the task is in `in_progress` |
| `400` | Body isn't JSON | Error `malformed_request` |
| `404` | Unknown task | Error `task_not_found` |
| `422` | `items` missing; an item `text` empty or > 300 chars; more than 50 items | Error `validation_failed` with `errors` (`items[2].text`) |

### `PUT /api/projects/{id}/capacity` — fixed points per sprint (US4, FR-017)

Request headers: `Content-Type: application/json`

```json
{ "points_per_sprint": 20 }
```

`null` removes the override and goes back to the estimate from hours and seniority.

| Status | When | Body |
|---|---|---|
| `200` | Saved | `{"capacity_override": 20, "sprints": [{"id", "load"}]}` |
| `400` | Body isn't JSON | Error `malformed_request` |
| `404` | Unknown project | Error `project_not_found` |
| `409` | Kanban project (continuous board, no sprint capacity) | Error `capacity_not_applicable` |
| `422` | Not an integer 1–500 or `null` | Error `validation_failed` with `errors` |

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: dependencies and entity fields

- [ ] T001 Install `@dnd-kit/sortable` in `frontend/` (`@dnd-kit/core` is already there) — handed off to spec 009 (frontend)
- [x] T002 Add `missing_role: str | None` to `Task` and the `Objective(id, project_id, sprint_id, title, done)` entity to `backend/app/domain/board.py` (move `Objective` out of `domain/project.py`); add `sprint_capacity_override: int | None` to `Project`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: persistence and read model the stories build on

**⚠️ CRITICAL**: no user story work can begin until this phase is complete

- [x] T003 Add `missing_role` to `TaskTable`, `sprint_capacity_override` to `ProjectTable` and a new `ObjectiveTable` in `backend/app/adapters/outbound/persistence/tables.py`, with mappers
- [x] T004 Add `get`/`save` to `SprintRepository`, a new `ObjectiveRepository` (list_by_project, add, save) and `objectives` on the `UnitOfWork` port, `SqlUnitOfWork` and `backend/tests/fakes.py`
- [ ] T005 Add `BoardView` (sprints with `SprintLoad` = points vs capacity, tasks, objectives, WIP limits from `project.plan["methodology"]`, `continuous` when the methodology is Kanban) to `backend/app/application/dto.py`
- [ ] T006 Implement `GetBoard` in `backend/app/application/use_cases/board/get_board.py` and `GET /api/projects/{id}/board` in `backend/app/adapters/inbound/http/board.py`; include the router in `main.py`
- [ ] T007 [P] Add `BoardGateway.getBoard()` to `frontend/src/application/ports.ts`, with http and fake implementations, and mirror `Objective`, `BoardView` and `missing_role` in `frontend/src/domain/board.ts` — handed off to spec 009 (frontend)

**Checkpoint**: the board read model is served (empty until a plan is applied)

---

## Phase 3: User Story 1 - The approved plan becomes a board (Priority: P1) 🎯 MVP

**Goal**: approving the sprints stage builds sprints, objectives and tasks with checklist and assignee

**Independent Test**: approve a mock-mode plan; each story appears exactly once in its sprint, with all its data

### Tests for User Story 1

- [ ] T008 [P] [US1] `build_board` tests in `backend/tests/unit/domain/test_board_builder.py`: one sprint + objective per iteration; stories in `todo` within their sprint; unsprinted stories in `backlog`; unknown story keys skipped and reported; checklist = one unchecked item per criterion; assignment by exact name, then role with fewest points in the sprint, else `missing_role`; duplicate member names → by role
- [ ] T009 [P] [US1] `ApplyPlan` tests (project → `ready`, `PlanApplied` published, running it twice creates nothing new) in `backend/tests/unit/application/test_apply_plan.py`

### Implementation for User Story 1

- [ ] T010 [US1] Implement `build_board(project_id, members, backlog, sprint_planning) -> BuiltBoard` with `assign()` and `checklist_from_criteria()` in `backend/app/domain/board.py`
- [ ] T011 [US1] Implement `ApplyPlan` in `backend/app/application/use_cases/planning/apply_plan.py`: skip if the project already has sprints, persist the built board, set `ready`, commit, publish `PlanApplied` (with the skipped story keys)
- [ ] T012 [US1] Register `ApplyPlan` as an `on_plan_completed` handler of spec 002's `AdvancePlanning` in `backend/app/adapters/inbound/http/dependencies.py`
- [ ] T013 [US1] Create `BoardPage` (route `/projects/:id/board`), `KanbanBoard`, `Column` and `TaskCard` (key, title, priority, points, assignee or "missing role", checklist progress) in `frontend/src/ui/` — handed off to spec 009 (frontend)

**Checkpoint**: after approving the plan, the board shows up with its cards

---

## Phase 4: User Story 2 - Move cards between columns (Priority: P1)

**Goal**: drag between columns and reorder within a column, persisted, with WIP warnings and revert on failure

**Independent Test**: drag a card to another column, reload, it's still there

### Tests for User Story 2

- [ ] T014 [P] [US2] `reorder` and `wip_warnings` tests in `backend/tests/unit/domain/test_board_rules.py`
- [ ] T015 [P] [US2] `MoveTask` tests (status/position saved, positions compacted, WIP warning returned without blocking, `TaskStatusChanged` published, 404) in `backend/tests/unit/application/test_move_task.py`
- [ ] T016 [P] [US2] API test for `PATCH /api/tasks/{id}` with a move in `backend/tests/integration/adapters/test_board_api.py`

### Implementation for User Story 2

- [ ] T017 [US2] Implement `reorder(tasks, task_id, status, position)` and `wip_warnings(tasks, wip_limits)` in `backend/app/domain/board.py`
- [ ] T018 [US2] Implement `MoveTask` in `backend/app/application/use_cases/board/move_task.py` (returns the task + WIP warnings) and call its `after_task_changed` handlers (empty by default; spec 008 registers objective evaluation)
- [ ] T019 [US2] Add `PATCH /api/tasks/{id}` (move) to `backend/app/adapters/inbound/http/board.py`
- [ ] T020 [US2] Wire dnd-kit in `KanbanBoard` (`DndContext` + `SortableContext` per column); `useBoard` applies the move optimistically, calls `BoardGateway.moveTask` and reverts with a toast on error; `Column` shows the WIP warning — handed off to spec 009 (frontend)

**Checkpoint**: User Stories 1 and 2 work independently

---

## Phase 5: User Story 3 - Edit a task and its checklist (Priority: P2)

**Goal**: edit title, description, points, priority and owner; check, add, edit and remove checklist items

**Independent Test**: change a card's priority, check an item and add another; reload and see the changes

### Tests for User Story 3

- [ ] T021 [P] [US3] `UpdateTask` and `UpdateChecklist` tests (assigning clears `missing_role`; progress recalculated; complete checklist returns `suggest_advance` but doesn't move; `TaskUpdated` published) in `backend/tests/unit/application/test_update_task.py`

### Implementation for User Story 3

- [ ] T022 [US3] Implement `UpdateTask` in `backend/app/application/use_cases/board/update_task.py` with `after_task_changed` handlers (spec 007 registers issue sync)
- [ ] T023 [US3] Implement `UpdateChecklist` (replace the item list) in `backend/app/application/use_cases/board/update_checklist.py`
- [ ] T024 [US3] Accept edit fields in `PATCH /api/tasks/{id}` and add `PUT /api/tasks/{id}/checklist` in `backend/app/adapters/inbound/http/board.py`
- [ ] T025 [US3] Create `TaskDrawer` and `Checklist` with `useTaskEditor`; show the "move to In review?" suggestion when the checklist completes — handed off to spec 009 (frontend)

**Checkpoint**: User Stories 1–3 work independently

---

## Phase 6: User Story 4 - Navigate and reorganize sprints (Priority: P2)

**Goal**: one sprint at a time, move cards between sprints or to the backlog, points vs capacity with an overload warning, and a continuous board for Kanban

**Independent Test**: with 3 sprints, move a 5-point card from sprint 1 to 2; both totals update

### Tests for User Story 4

- [ ] T026 [P] [US4] Tests: moving to another sprint lands in `todo`; `SprintLoad` uses `domain/capacity.py` or the override; `continuous` for Kanban, in `backend/tests/unit/application/test_move_task.py` and `test_board_rules.py`

### Implementation for User Story 4

- [ ] T027 [US4] Accept `sprint_id` (or `null` for backlog) in `MoveTask`
- [ ] T028 [US4] Implement `SetCapacity` (`backend/app/application/use_cases/board/set_capacity.py`) and `PUT /api/projects/{id}/capacity` for the fixed points override (FR-017)
- [ ] T029 [US4] Create `SprintSelector` (defaults to the first sprint with unfinished tasks) and `CapacityBar` (overload warning); drop target "Move to sprint…" on cards; continuous layout without selector when `continuous`, objectives as a filter — handed off to spec 009 (frontend)

**Checkpoint**: User Stories 1–4 work independently

---

## Phase 7: User Story 5 - Filter the board (Priority: P3)

**Goal**: filter by owner ("My tasks"), priority and epic, kept when switching sprints

**Independent Test**: turn on "My tasks"; only that member's cards remain

### Implementation for User Story 5

- [ ] T030 [US5] Add `filterTasks(tasks, filters)` to `frontend/src/domain/rules.ts` and `BoardFilters`, with the filter state in the URL search params so it survives sprint changes — handed off to spec 009 (frontend)

**Checkpoint**: all user stories work independently

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T031 [P] Run the `vercel-react-best-practices` and `web-design-guidelines` skills on `frontend/src/ui/components/board/` (re-renders while dragging, keyboard drag, focus) — handed off to spec 009 (frontend)
- [ ] T032 [P] Agree on the visual direction with the `frontend-design` skill and save the token plan in this plan (shared with spec 004) — handed off to spec 009 (frontend)
- [ ] T033 Check FR-019: every board change publishes an event spec 005 can show

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → **Foundational (Phase 2)** → user stories → **Polish**

### User Story Dependencies

- **US1 (P1)**: after Foundational; triggered by spec 002, testable alone by calling `ApplyPlan` with the mock plan
- **US2 (P1)**: needs tasks to exist (US1 or test fixtures)
- **US3 (P2)**: independent from US2; shares `PATCH /api/tasks/{id}`
- **US4 (P2)**: extends `MoveTask` (US2)
- **US5 (P3)**: frontend only, on top of US1

### Cross-spec dependencies

- **002 → 003**: `ApplyPlan` runs as an `on_plan_completed` handler; `domain/capacity.py` (spec 002, T006) is the shared capacity rule; if it doesn't exist yet when this plan starts, create it here exactly as specified there.
- **001**: reuses the frontend shell (Tailwind, router, container) and `backend/tests/fakes.py`.
- **005 → 003 (contract)**: `PlanApplied` carries `project_id` and the skipped story keys; board events (`TaskStatusChanged`, `TaskUpdated`, `PlanApplied`) are what the activity feed shows.
- **007**: registers issue sync as an `after_task_changed` handler of `UpdateTask` and adds issue badges to `TaskCard`.
- **008**: registers objective evaluation as an `after_task_changed` handler of `MoveTask` and closes sprints.

### Within Each User Story

- Domain functions before use cases
- Use cases before endpoints
- Endpoint before UI

## Notes

- [Story] labels map tasks to user stories for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group, and check the box here
- Avoid: vague tasks, editing the same file from two parallel tasks, cross-story dependencies that break independence
