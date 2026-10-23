# Implementation Plan: 014 · Board views, filters and quick add

**Date**: 2026-10-23  
**Spec**: [spec.md](spec.md)  
**Status**: Draft

## Summary

Backend: `CreateTask` and `POST /api/projects/{id}/tasks`, built on spec 003's rules (`task_change_errors`, `check_target_sprint`, `board_warnings`) plus a pure `next_task_key`, publishing a new `task_created` event that spec 008's objective evaluation also listens to. Frontend: the gateway and fake for it, `useCreateTask`, an "Agregar tarea" field at the end of each column, a toolbar with a `Segmented` view switch and a `FilterButton` (a new `Popover` in the design system), a `TaskList` view, and a `TeamAvatars` stack in the header.

## Technical Context

**Language/Version**: Python 3.13 (backend), TypeScript 6 + React 19 (frontend)  
**Primary Dependencies**: FastAPI, SQLModel; TanStack Query, the existing design system  
**Storage**: SQLite through the existing `TaskRepository.add`; no schema change  
**Testing**: pytest (unit with `tests/fakes.py`, integration with the API client); Vitest + Testing Library on the fake gateways  
**Target Platform**: evergreen browsers, 360 px and up  
**Project Type**: web (backend + frontend)  
**Performance Goals**: a created card shows as soon as the service answers (< 200 ms locally)  
**Constraints**: hexagonal layers (`tests/architecture/test_layers.py`); design system rules (`check-design-rules.mjs`); API conventions  
**Scale/Scope**: one use case and endpoint, one event; four UI pieces and one design system component

## Decisions

- **Keys are `US-N`, one more than the highest `US-N` of the project.** Pure function `next_task_key(tasks)` in `domain/board.py`. Keys of other shapes (a replan's `BUG-3`) are ignored. Discarded tasks are deleted, so a key could come back after the highest one is discarded; that's accepted (the issue link keeps its own number).
- **Defaults come from `Task`**: priority `medium`, 1 point, `feature`, no epic, no checklist. Status: the one sent, else `todo` in a sprint or on a continuous board, `backlog` with no sprint. Position: always the end of the column, so no `position` field.
- **Validation reuses `task_change_errors`** with the title made required, and `check_target_sprint` for closed sprints (409 `sprint_closed`). An `epic_key` longer than 20 characters is a 422.
- **`task_created` is its own event** (not `task_updated`): the activity says "US-13 created", issue sync (spec 007) ignores it because nothing is published yet, and objective evaluation (spec 008) handles it like a status change, since a met sprint has work again.
- **The UI applies the active filters to the new task** (assignee, priority, epic) so it doesn't vanish from a filtered board (FR-003).
- **Filters move into a `Popover`**: a button that opens a non-modal panel (`role="dialog"`, labelled by the button), closed by Escape or a click outside, focus back to the button. Inside, each filter is a group of `Chip`s (pressed state), which already work with the keyboard.
- **The view lives in the address (`view=list`)**, like the filters and the sprint. The list is a `Row list` (rows on `inset`, no lines) grouped by column, so it follows the design system with no table component.
- **Column hues are a design system exception, not a loophole.** Rule 1 (no status dots) gets one exception, written in the design system and in spec 009 FR-002: the board's column label. The dot lives in one component, `ds/ColumnLabel.tsx`, the only file `check-design-rules.mjs` lets use a small round shape. The label is a `card` pill with the hue's text and the dot in `currentColor`, so it shows on its tinted panel.
- **Tinted lanes are tokens per hue**: `lane-blue`, `lane-amber`, `lane-teal`. In light they are the hue's soft fill; in dark the soft fills are as light as a `card` (1.02 to 1.05:1), so they get darker tints that keep the card 1.13 to 1.15:1 above the lane, like the neutral `lane`. Every text that goes on a lane (name, count, empty text, the amber WIP warning) passes 4.5:1 on all of them.

  | Token | Light | Dark |
  |---|---|---|
  | `lane-blue` | `#E8EEFD` | `#111829` |
  | `lane-amber` | `#FBF0DA` | `#1D180E` |
  | `lane-teal` | `#E0F4EF` | `#0E1D19` |

- **The column makes room with dnd-kit's multiple containers pattern.** `KanbanBoard` keeps a draft of the tasks while dragging: `onDragOver` moves the dragged task into the hovered column at the hovered index with `moveTask` (the same pure rule the optimistic move uses), so the target `SortableContext` contains it and opens the gap with its sorting strategy. `onDragEnd` saves the draft position; `onDragCancel` drops the draft. Nothing is saved until the drop.
- **`TeamAvatars`** is a link to `/projects/{id}/settings`: up to four `Avatar`s overlapping by 4px with a 2px `bg` ring, then "+N". The ring is the page color, not a stroke on a card.

## Project Structure

### Documentation (this feature)

```text
specs/014-board-views-quick-add/
├── plan.md              # This file
└── spec.md              # Feature spec
```

### Source Code (repository root)

```text
backend/
├── app/domain/board.py                                   # next_task_key, new_task_errors
├── app/domain/events.py                                  # TaskCreated
├── app/application/dto.py                                # TaskCreate
├── app/application/use_cases/board/create_task.py        # NEW: CreateTask
├── app/application/use_cases/board/evaluate_objectives.py# also on task_created
├── app/adapters/inbound/http/board.py                    # POST /projects/{id}/tasks
├── app/adapters/inbound/http/dependencies.py             # get_create_task
├── tests/unit/domain/test_board_rules.py                 # next_task_key
├── tests/unit/application/test_create_task.py            # NEW
└── tests/integration/adapters/test_board_api.py          # POST /tasks
frontend/
├── scripts/check-design-rules.mjs                        # the dot only in ColumnLabel
├── docs/api-contract.md                                  # POST /tasks, task_created
├── design-system/README.md                               # Popover, avatar stack, add field, task list
└── src/
    ├── domain/board.ts, domain/events.ts                 # NewTask, task_created
    ├── application/ports.ts, liveUpdates.ts              # createTask, task_created refetch
    ├── application/use-cases/useBoard.ts                 # useCreateTask
    ├── adapters/http/boardGateway.ts, fake/boardGateway.ts
    ├── ui/components/ds/Popover.tsx                      # NEW
    ├── ui/components/ds/ColumnLabel.tsx                  # NEW: the one place with a dot
    ├── ui/styles/tokens.css, index.css                   # lane-blue, lane-amber, lane-teal
    ├── ui/components/board/AddTask.tsx                   # NEW
    ├── ui/components/board/BoardFilters.tsx              # FilterButton
    ├── ui/components/board/TaskList.tsx                  # NEW
    ├── ui/components/board/TeamAvatars.tsx               # NEW
    ├── ui/components/board/Column.tsx, KanbanBoard.tsx   # add field at the end
    └── ui/pages/BoardPage.tsx (+ test)                   # toolbar, view switch
```

**Structure Decision**: backend inside spec 003's board use cases and router; frontend inside `board/` and `ds/`.

## API Contract

### `POST /api/projects/{id}/tasks` — create a task (US1)

Request headers: `Content-Type: application/json`. Only `title` is required.

```json
{
  "title": "Revisar textos del checkout",
  "sprint_id": 6,
  "status": "todo",
  "description": "",
  "points": 1,
  "priority": "high",
  "assignee_id": 3,
  "epic_key": "E2"
}
```

- `sprint_id`: `null` or missing = the backlog (or the whole board when continuous). `status`: missing = `todo` in a sprint or on a continuous board, `backlog` otherwise.
- The task gets the next `US-N` key and goes to the end of its column. Unsent fields take the defaults: `medium`, 1 point, `feature`, no epic, no checklist, unassigned.

| Status | When | Body |
|---|---|---|
| `201` | Created; publishes `task_created`. `Location: /api/tasks/{id}` | `{"task": Task, "warnings": [Warning], "suggest_advance": false}` |
| `400` | Body isn't JSON | Error `malformed_request` |
| `404` | Unknown project | Error `project_not_found` |
| `409` | `sprint_id` is a closed sprint (spec 008) | Error `sprint_closed` |
| `422` | `title` missing, empty or > 200 chars; `status` or `priority` not in the enum; `points` not 0–100; `sprint_id` or `assignee_id` not from this project; `epic_key` > 20 chars. Nothing is saved | Error `validation_failed` with `errors` |

### Event `task_created`

`{"type": "task_created", "task_id": 41, "key": "US-13", "status": "todo", "sprint_id": 6, "actor": "person", "summary": "US-13 created", "ref": {"kind": "task", "id": 41}}`. The frontend refetches the board and the plan views, as for `task_updated`.

## Phase 1: Setup

- [x] T001 Write spec 014 and this plan; add the spec to [specs/README.md](../README.md)

---

## Phase 2: Foundational

**Purpose**: the endpoint the add field calls, and its contract on both sides

- [x] T002 [P] `next_task_key` and `new_task_errors` in `backend/app/domain/board.py`, with tests in `tests/unit/domain/test_board_rules.py`
- [x] T003 `TaskCreated` in `domain/events.py`, `TaskCreate` in `dto.py`, `CreateTask` in `use_cases/board/create_task.py` (after_task_changed handlers run too), with tests in `tests/unit/application/test_create_task.py`
- [x] T004 `POST /api/projects/{id}/tasks` (201 + `Location`) and `get_create_task`; integration tests in `test_board_api.py`
- [x] T005 `EvaluateObjectives.on_task_changed` also on `task_created`, with a test
- [x] T006 [P] Frontend contract: `NewTask` and the `task_created` event in `src/domain`, `createTask` in `ports.ts`, http and fake gateways, `task_created` in `liveUpdates.ts`; update [frontend/docs/api-contract.md](../../frontend/docs/api-contract.md)

---

## Phase 3: User Story 1 - Add a task where it goes (Priority: P1)

**Goal**: "Agregar tarea" at the end of each column

**Independent Test**: add "Revisar textos del checkout" to "Por hacer" on the fake service; it's there after a reload

- [x] T007 [US1] `useCreateTask` in `useBoard.ts` (puts the task in the board cache, field errors back to the form, toast with retry on failure)
- [x] T008 [US1] `AddTask` in `board/AddTask.tsx`: quiet button, then a field that creates on Enter, stays open, closes on Escape or when left empty; shown only on open sprints; the board's filters applied to the new task
- [x] T009 [US1] Test: adding two tasks in a row, Escape closes, the filters are applied, no field on a closed sprint

---

## Phase 4: User Story 2 - Filters behind one button (Priority: P1)

**Goal**: one "Filtrar" button with a panel

**Independent Test**: pick Ana and "Alta": "Filtrar 2", the address has both, "Quitar filtros" clears

- [x] T010 [US2] `Popover` in `ds/Popover.tsx` (button, non-modal panel, Escape and outside click close, focus back) and its row in the design system
- [x] T011 [US2] Turn `BoardFilters` into the "Filtrar" button with responsable, épica and prioridad groups; count on the button; "Quitar filtros" next to it
- [x] T012 [US2] Test: picking two filters shows the count and filters the cards; "Quitar filtros" clears them

---

## Phase 5: User Story 3 - The board or a list (Priority: P2)

**Goal**: "Tablero" / "Lista" switch and the list view

**Independent Test**: `view=list` shows the groups and a row opens the panel

- [x] T013 [US3] Toolbar on `BoardPage`: `Segmented` "Tablero" / "Lista" in the address (`view`), "Filtrar" on the right
- [x] T014 [US3] `TaskList` in `board/TaskList.tsx`: groups per column with name and count, rows with key, title, responsable, priority, points and checklist; Enter or click opens the panel; data hides under 640 px
- [x] T015 [US3] Test: the list groups the tasks and a row opens the panel

---

## Phase 6: User Stories 5 and 6 - Column colors and room for the card (Priority: P2)

- [x] T021 [US5] Tokens `lane-blue`, `lane-amber`, `lane-teal`; `ColumnLabel` in `ds/ColumnLabel.tsx`; the exception in design system rule 1, spec 009 FR-002 and `check-design-rules.mjs`
- [x] T022 [US5] Column hues in `boardLabels.ts`; `Column` and the list groups use `ColumnLabel` and the tinted lane
- [x] T023 [US6] Draft tasks while dragging in `KanbanBoard` (`onDragOver` moves the card into the hovered column; drop saves it; cancel puts it back)
- [x] T024 [US6] Check in the browser (jsdom has no layout for dnd-kit): dragging over another column opens the gap there and closes the source column, the drop lands in the gap, and Escape puts it back

---

## Phase 7: User Story 4 - Who's on the team (Priority: P3)

- [x] T016 [US4] `TeamAvatars` in the board header (four, then "+N"; accessible name with the names; link to settings) and its row in the design system
- [x] T017 [US4] Test: six members show four initials and "+2" with the full list as the name

---

## Phase 8: Polish & Cross-Cutting Concerns

- [x] T018 [P] Backend: `pytest` (architecture tests included)
- [x] T019 [P] Frontend: `npm run lint`, `npm run typecheck` and `npm test`
- [ ] T020 Manual pass in the browser at 1536×864 and 360 px, both themes, keyboard only (pointer, both themes and 360 px done; a keyboard-only pass is still to do)

## Notes

- [Story] labels map tasks to user stories for traceability.
- Spec 003 owns the task endpoints: this plan adds one next to them, with the same rules, and its contract lives here and in [frontend/docs/api-contract.md](../../frontend/docs/api-contract.md).
