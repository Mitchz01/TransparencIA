# Implementation Plan: 001 · Project and team setup

**Date**: 2026-10-23  
**Spec**: [spec.md](spec.md)  
**Status**: Approved

## Summary

Create, read and edit a project with its team, with all-or-nothing validation, and report team changes. Backend only: `CreateProject`, `GetProject`, `ListProjects` and `UpdateProject` use cases behind `/api/projects`, with the validation rules in the domain and a `TeamChanged` event that other specs subscribe to through a handler hook. Removed members are deactivated, not deleted, so done tasks keep who did them and pending ones are unassigned.

The screens and the frontend shell (Tailwind, router, gateway container) are out of this spec's scope. Their tasks are kept, with their original ids, in [Handed off: frontend](#handed-off-frontend) so whoever builds the screens can pick them up.

## Technical Context

**Language/Version**: Python 3.13  
**Primary Dependencies**: FastAPI, Pydantic, SQLModel  
**Storage**: SQLite through the existing persistence adapter (`project` and `member` tables; `member` gets an `active` column)  
**Testing**: pytest (unit with an in-memory UnitOfWork, integration with TestClient on in-memory SQLite)  
**Target Platform**: local dev server, Cloud Run as the deployment target  
**Project Type**: web (backend + frontend); this plan only touches `backend/`  
**Performance Goals**: create, read and edit respond in < 1 s (SC-001)  
**Constraints**: hexagonal dependency rule (`tests/architecture/test_layers.py`); works without a Gemini key (FR-011)  
**Scale/Scope**: a handful of projects with 1–15 members each; 4 endpoints

## Project Structure

### Documentation (this feature)

```text
specs/001-project-team-setup/
├── plan.md              # This file
└── spec.md              # Feature spec
```

### Source Code (repository root)

```text
backend/app/
├── domain/
│   ├── project.py                       # + normalization, validate_project(), diff_team()
│   ├── errors.py                        # + ValidationFailed, MethodologyLocked
│   └── events.py                        # + TeamChanged, MemberChange
├── application/
│   ├── dto.py                           # + ProjectUpdate, MemberUpsert, ProjectSummary
│   └── use_cases/projects/
│       ├── create_project.py
│       ├── get_project.py
│       ├── list_projects.py
│       └── update_project.py            # TeamChanged + on_team_changed handlers
└── adapters/
    ├── inbound/http/
    │   ├── projects.py                  # /api/projects
    │   ├── dependencies.py              # + project use case providers
    │   └── errors.py                    # + 422 / 409 mapping
    └── outbound/persistence/
        ├── tables.py                    # + MemberTable.active
        └── repositories.py              # SqlProjectRepository.save syncs members

backend/tests/
├── fakes.py                             # InMemoryUnitOfWork, RecordingEventBus (shared by all specs)
├── unit/domain/test_project_rules.py
├── unit/application/test_create_project.py
├── unit/application/test_update_project.py
└── integration/adapters/test_projects_api.py
```

**Structure Decision**: the existing hexagonal layout. Code goes into `domain/`, `application/use_cases/projects/` and the HTTP and persistence adapters. No frontend files.

## API Contract

Follows [plan/api-conventions.md](../../plan/api-conventions.md) (headers, error body, status codes). This spec also **implements** the backend side of those conventions for everyone (T006); the frontend side is the handed-off T004. The API tests assert every status row below.

### Shared shapes

**Member**

```json
{
  "id": 3,
  "name": "Ana Gómez",
  "role": "Backend",
  "seniority": "senior",
  "hours_per_week": 30,
  "skills": ["python", "fastapi"]
}
```

`seniority`: `junior` | `mid` | `senior`. Spec 007 adds `github_username: string | null`.

**Project**

```json
{
  "id": 12,
  "name": "Agile Planner",
  "description": "Jira-like tool where AI agents plan the work.",
  "duration_weeks": 8,
  "requested_methodology": "auto",
  "status": "draft",
  "auto_approve": false,
  "repository": null,
  "plan": null,
  "members": [ /* Member */ ],
  "created_at": "2026-10-23T14:05:00Z"
}
```

- `requested_methodology`: `auto` | `scrum` | `kanban` | `scrumban` | `xp` | `shape_up`.
- `status`: `draft` | `planning` | `ready` | `error`.
- `plan`: the approved stage outputs keyed by stage (spec 002), `null` until the first approval.
- Spec 007 adds `has_token: bool`; the token itself is never returned.

**ProjectSummary**

```json
{ "id": 12, "name": "Agile Planner", "status": "ready", "duration_weeks": 8, "member_count": 4, "created_at": "2026-10-23T14:05:00Z" }
```

### Validation rules (FR-004)

Used by `POST` and `PATCH`; every failing field is listed in `errors`.

| Field | Rule | `message` |
|---|---|---|
| `name` | Required, 1–120 chars after trimming | `Required.` / `Max 120 characters.` |
| `description` | Required, 1–5000 chars | `Required.` / `Max 5000 characters.` |
| `duration_weeks` | Integer 1–52 | `Must be between 1 and 52.` |
| `requested_methodology` | One of the enum values | `Must be one of: auto, scrum, kanban, scrumban, xp, shape_up.` |
| `members` | At least 1 | `The team needs at least one member.` |
| `members[i].name` | Required; unique in the team (case-insensitive, after trimming) | `Required.` / `Duplicated name.` |
| `members[i].role` | Required, 1–60 chars | `Required.` |
| `members[i].seniority` | `junior` \| `mid` \| `senior` | `Must be one of: junior, mid, senior.` |
| `members[i].hours_per_week` | Integer 1–60 | `Must be between 1 and 60.` |
| `members[i].skills` | List of strings, each 1–40 chars; duplicates removed | `Max 40 characters.` |
| `members[i].id` (PATCH only) | Must belong to this project | `Unknown member.` |

### `POST /api/projects` — create a project (US1)

Request headers: `Content-Type: application/json`

```json
{
  "name": "Agile Planner",
  "description": "Jira-like tool where AI agents plan the work.",
  "duration_weeks": 8,
  "requested_methodology": "auto",
  "auto_approve": false,
  "members": [
    { "name": "Ana Gómez", "role": "Backend", "seniority": "senior", "hours_per_week": 30, "skills": ["python"] },
    { "name": "Leo Ruiz", "role": "Frontend" }
  ]
}
```

Defaults: `duration_weeks` 8, `requested_methodology` `auto`, `auto_approve` false, `seniority` `mid`, `hours_per_week` 20, `skills` `[]`.

| Status | When | Body |
|---|---|---|
| `201` | Created in `draft`; planning is **not** started (FR-005) | `Project` + `Location: /api/projects/{id}` |
| `400` | Body isn't JSON | Error `malformed_request` |
| `422` | Any rule in the table above fails; nothing is saved | Error `validation_failed` with `errors` |

### `GET /api/projects` — list projects (US2)

No body. Newest first.

| Status | When | Body |
|---|---|---|
| `200` | Always (empty list if there are none) | `ProjectSummary[]` |

### `GET /api/projects/{id}` — read a project (US2)

| Status | When | Body |
|---|---|---|
| `200` | Exists | `Project` |
| `404` | Unknown id | Error `project_not_found` |

### `PATCH /api/projects/{id}` — edit the project and the team (US3)

Request headers: `Content-Type: application/json`. Every field is optional; at least one is required.

```json
{
  "description": "New description",
  "auto_approve": true,
  "members": [
    { "id": 3, "name": "Ana Gómez", "role": "Backend", "seniority": "senior", "hours_per_week": 25, "skills": ["python"] },
    { "name": "Sofía Paz", "role": "QA" }
  ]
}
```

- `members`, when present, is the **whole new team**: items with `id` are edited, items without `id` are added, current members missing from the list are removed.
- `requested_methodology` can only change while `status` is `draft` (FR-009).
- Allowed while the project is `planning` (FR-007).

| Status | When | Body |
|---|---|---|
| `200` | Saved; a `team_changed` event is published if the team changed (FR-010) | `Project` |
| `400` | Body isn't JSON | Error `malformed_request` |
| `404` | Unknown project | Error `project_not_found` |
| `409` | Methodology changed after planning started | Error `methodology_locked` |
| `422` | Empty body, a rule fails, or a member `id` isn't from this project; nothing is saved | Error `validation_failed` with `errors` |

---

## Phase 1: Setup (Shared Infrastructure)

No backend setup is needed: the frontend shell tasks (T001–T005) are [handed off](#handed-off-frontend).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: domain rules, errors and test fakes the stories build on

**⚠️ CRITICAL**: no user story work can begin until this phase is complete

- [x] T006 Add `ValidationFailed(errors: list[FieldError])` and `MethodologyLocked` to `backend/app/domain/errors.py`, and give every `DomainError` a stable `code`. In `backend/app/adapters/inbound/http/errors.py` implement the shared conventions ([plan/api-conventions.md](../../plan/api-conventions.md), "Implementation checklist"): the error body `{code, detail, errors}`, the status table, `RequestValidationError` → 400 (bad JSON) / 422, a catch-all 500 and the `X-Request-Id` middleware; test them in `backend/tests/integration/adapters/test_errors.py`
- [x] T007 Add to `backend/app/domain/project.py`: `normalize_name()` (trim + collapse spaces), skill dedup, and `validate_project(project)` covering FR-004 (required fields, ≥ 1 member, unique names case-insensitive, duration 1–52, hours 1–60)
- [x] T008 [P] Add `ProjectUpdate` (all fields optional, `members: list[MemberUpsert] | None`) and `ProjectSummary` to `backend/app/application/dto.py`; `MemberUpsert` carries an optional `id` so existing members are edited, not recreated
- [x] T009 [P] Create `backend/tests/fakes.py` with `InMemoryUnitOfWork` (dict-backed repos for every port in `application/ports/repositories.py`) and `RecordingEventBus`
- [x] T010 Add `MemberTable.active: bool = True` in `backend/app/adapters/outbound/persistence/tables.py`, and make `SqlProjectRepository.save` in `repositories.py` sync the team: update members with an id, insert new ones and set `active = False` on missing ones (never delete, so done tasks keep their assignee). `Project.members` only returns active members. `create_all` doesn't migrate: delete any local `agile.db`

**Checkpoint**: foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Create a project with its team (Priority: P1) 🎯 MVP

**Goal**: the leader creates a project in draft with its team through the API

**Independent Test**: POST a project with two members; the response has an id, `draft` status and both members; a later GET returns the same data

### Tests for User Story 1

- [x] T011 [P] [US1] Unit tests for `validate_project` (every FR-004 case, normalization, defaults) in `backend/tests/unit/domain/test_project_rules.py`
- [x] T012 [P] [US1] Use case tests (draft status, nothing saved on invalid input, planning not started) in `backend/tests/unit/application/test_create_project.py`
- [x] T013 [P] [US1] API test for `POST /api/projects` (201 + `Location`, 400, 422 with every failing field in `errors`) in `backend/tests/integration/adapters/test_projects_api.py`

### Implementation for User Story 1

- [x] T014 [US1] Implement `CreateProject` in `backend/app/application/use_cases/projects/create_project.py` (normalize, validate, `projects.add`, commit; status always `draft`)
- [x] T015 [US1] Create `backend/app/adapters/inbound/http/projects.py` with `POST /api/projects` (201), add its provider to `dependencies.py` and include the router in `backend/app/main.py`

**Checkpoint**: a project can be created through the API

---

## Phase 4: User Story 2 - Read a project (Priority: P1)

**Goal**: get a project with its team by id, and list projects

**Independent Test**: create a project, GET it by id and compare; GET an unknown id returns 404

### Tests for User Story 2

- [x] T020 [P] [US2] API tests for `GET /api/projects` and `GET /api/projects/{id}` (200, 404 `project_not_found`) in `backend/tests/integration/adapters/test_projects_api.py`

### Implementation for User Story 2

- [x] T021 [US2] Implement `GetProject` (raises `ProjectNotFound`) and `ListProjects` (returns `ProjectSummary`) in `backend/app/application/use_cases/projects/`
- [x] T022 [US2] Add `GET /api/projects` and `GET /api/projects/{id}` to `backend/app/adapters/inbound/http/projects.py`

**Checkpoint**: User Stories 1 and 2 work independently

---

## Phase 5: User Story 3 - Edit the project and the team (Priority: P2)

**Goal**: partial, all-or-nothing edits of project and team data

**Independent Test**: add a third member and change someone's hours; GET shows three members, the new hours and everything else unchanged

### Tests for User Story 3

- [x] T024 [P] [US3] Use case tests (partial change, add/edit/remove members, empty team rejected, methodology locked once planning started, pending tasks of a removed member unassigned and done ones untouched, 404) in `backend/tests/unit/application/test_update_project.py`
- [x] T025 [P] [US3] Persistence test for member sync (insert, update and deactivate in one save; inactive members not returned) in `backend/tests/integration/adapters/test_persistence.py`

### Implementation for User Story 3

- [x] T026 [US3] Implement `UpdateProject` in `backend/app/application/use_cases/projects/update_project.py`: apply only the given fields, validate the result, raise `MethodologyLocked` if the methodology changes and `status != "draft"`, set `assignee_id = None` on the not-done tasks of removed members (`uow.tasks.list_by_project` + `save`), save and commit
- [x] T027 [US3] Add `PATCH /api/projects/{id}` to `backend/app/adapters/inbound/http/projects.py`

**Checkpoint**: User Stories 1–3 work independently

---

## Phase 6: User Story 4 - Report that the team changed (Priority: P3)

**Goal**: a single `TeamChanged` event per edit that touches the team

**Independent Test**: add one member and remove another in the same edit; exactly one `TeamChanged` with both changes is published; renaming the project publishes nothing

### Tests for User Story 4

- [x] T029 [P] [US4] Unit tests for `diff_team` (joined, left, changed fields; no diff when only project fields change) in `backend/tests/unit/domain/test_project_rules.py`
- [x] T030 [P] [US4] Use case tests: one event per edit, none for invalid edits, handlers called with the event, in `backend/tests/unit/application/test_update_project.py`

### Implementation for User Story 4

- [x] T031 [US4] Add `TeamChanged(joined, left, changed: list[MemberChange])` to `backend/app/domain/events.py` and `diff_team(old, new)` to `backend/app/domain/project.py`
- [x] T032 [US4] Publish `TeamChanged` from `UpdateProject` after commit and call its `on_team_changed` handlers (constructor argument, empty by default); spec 008 registers its drift handler there

**Checkpoint**: all user stories work independently

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T035 Update the TODO list in `README.md`, including the note about deleting a local `agile.db` (T010)

---

## Handed off: frontend

Out of this spec's scope (see the spec's Scope section). Kept here with their original ids so they aren't lost; whoever builds the screens moves them to their plan. T001–T005 are the shell that the screens of specs 002, 003 and 005 also reuse.

- T001 Install Tailwind (`npm i -D tailwindcss @tailwindcss/vite`), add `tailwindcss()` to `frontend/vite.config.ts` and `@import "tailwindcss"` to `frontend/src/ui/styles/index.css`
- T002 Replace the Vite template in `frontend/src/app/App.tsx` with a layout (header + `<Outlet/>`) and remove `App.css` and the template assets
- T003 Create `frontend/src/app/routes.tsx` with React Router and mount it from `frontend/src/main.tsx`
- T004 Create `frontend/src/adapters/http/client.ts`: `fetch` wrapper with JSON, base path `/api`, an `X-Request-Id` per request, and a typed `ApiError` (status + `code`, `detail`, `errors[]`), as described in [frontend/docs/api-contract.md](../../frontend/docs/api-contract.md)
- T005 Create `frontend/src/app/container.tsx`: `GatewaysProvider` + `useGateways()`, choosing http or fake gateways with `VITE_USE_FAKE`
- T016 Add `ProjectCreate` and client-side validation mirroring FR-004 to `frontend/src/domain/project.ts`
- T017 Add `ProjectGateway` to `frontend/src/application/ports.ts`; implement it in `frontend/src/adapters/http/projectGateway.ts` and `frontend/src/adapters/fake/projectGateway.ts`
- T018 Create `ProjectForm` and `MemberFields` (add/remove rows, role, seniority, hours, skills) in `frontend/src/ui/components/project/`
- T019 Create `NewProjectPage` with `useSaveProject`, showing the 422 field errors inline; route `/projects/new`
- T023 Create `ProjectsPage` (list + "New project") with `useProjects` and `useProject` hooks; route `/`
- T028 Create `ProjectSettingsPage` reusing `ProjectForm` in edit mode (methodology disabled when not in draft); route `/projects/:id/settings`
- T033 Mirror the new types (`ProjectUpdate`, `TeamChanged`) in `frontend/src/domain/project.ts` and `frontend/src/domain/events.ts`
- T034 Run the `web-design-guidelines` audit on the new pages and fix the findings

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: empty (frontend handed off)
- **Foundational (Phase 2)**: blocks all user stories
- **User Stories (Phase 3+)**: US1 and US2 can go in parallel after Phase 2; US3 needs US2's `GetProject`; US4 needs US3's `UpdateProject`
- **Polish**: after the desired stories

### User Story Dependencies

- **US1 (P1)**: after Foundational; no dependencies on other stories
- **US2 (P1)**: after Foundational; independent from US1 (tests create data through the repository)
- **US3 (P2)**: uses `GetProject` from US2
- **US4 (P3)**: extends `UpdateProject` from US3

### Cross-spec dependencies

- **001 → 002**: `StartPlanning` (spec 002) reads the project; 002's agent context excludes ids, status and auto-approve (already done in `_project_context`).
- **001 → 008**: `UpdateProject(on_team_changed=[...])` is the hook spec 008 uses to propose a replan.
- **003, 005, 007**: reuse `backend/tests/fakes.py` and the 422/409 error mapping. The frontend shell they also expected from this plan is [handed off](#handed-off-frontend) and has no owner yet.
- **003**: a done task can point to an inactive member; the board shows that member's name anyway (codigotpx).
- **007**: adds `github_username` to `Member`; this plan doesn't touch it.

### Within Each User Story

- Domain rules before use cases
- Use cases before endpoints
- Tests marked `[P]` can be written in parallel

## Notes

- [Story] labels map tasks to user stories for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group, and check the box here
- Avoid: vague tasks, editing the same file from two parallel tasks, cross-story dependencies that break independence
