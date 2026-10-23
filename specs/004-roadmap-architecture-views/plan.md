# Implementation Plan: 004 · Roadmap, methodology and architecture views

**Date**: 2026-10-23  
**Spec**: [spec.md](spec.md)  
**Status**: Approved

## Summary

One read-only endpoint, `GET /api/projects/{id}/plan`, returns the three plan views (roadmap, methodology and architecture) ready to draw (UC-07). Backend only. The views are built by a **pure domain function** from three things other specs already produce: the approved plan in `project.plan` (written by spec 002's `AdvancePlanning`), the proposals of each stage (rationale, date and how it was approved, spec 005) and the board's tasks (progress, spec 003). It writes nothing (FR-009).

## Technical Context

**Language/Version**: Python 3.13  
**Primary Dependencies**: FastAPI, Pydantic  
**Storage**: SQLite. No new tables: reads `project`, `proposal` (002/005) and `task` (003)  
**Testing**: pytest. The pure function with hand-built cases, the use case with `backend/tests/fakes.py`, and an API test using `MOCK_PLAN`  
**Target Platform**: Linux server; Cloud Run as the deployment target  
**Project Type**: web (backend + frontend); this plan only touches `backend/`  
**Performance Goals**: the three views of a project with 50 tasks in < 1 s (SC-001): three queries and an in-memory build  
**Constraints**: hexagonal dependency rule; the domain gets today's date as a parameter (it never reads the clock), so the current week is testable  
**Scale/Scope**: up to ~10 phases, ~30 epics and a few hundred tasks per project

## Project Structure

### Documentation (this feature)

```text
specs/004-roadmap-architecture-views/
├── plan.md              # This file
└── spec.md              # Feature spec
```

### Source Code (repository root)

```text
backend/app/
├── domain/
│   └── plan_views.py                    # NEW: view models + build_plan_views() (pure)
├── application/use_cases/projects/
│   └── get_plan_views.py                # GetPlanViews
└── adapters/inbound/http/
    ├── projects.py                      # + GET /api/projects/{id}/plan (spec 001's router)
    └── dependencies.py                  # + provider, today()

backend/tests/
├── unit/domain/test_plan_views.py
├── unit/application/test_get_plan_views.py
└── integration/adapters/test_plan_views_api.py
```

**Structure Decision**: the existing hexagonal layout. The endpoint goes in spec 001's `projects.py` router because it's a resource of the project; the use case in `use_cases/projects/`, as [use-cases.md](../../plan/use-cases.md) says for UC-07. No frontend files.

## Design

### Models (`domain/plan_views.py`)

```python
ViewStatus = Literal["not_generated", "pending", "approved"]
Decision = Literal["leader", "adjusted", "auto"]

class ViewOrigin(BaseModel):
    agent: str
    rationale: str
    approved_at: datetime
    decision: Decision

class StageView(BaseModel, Generic[T]):
    status: ViewStatus
    origin: ViewOrigin | None = None      # only when status == "approved"
    content: T | None = None              # only when status == "approved"

class Progress(BaseModel):
    tasks: int
    tasks_done: int
    points: int
    points_done: int

class EpicView(BaseModel):
    key: str
    title: str
    description: str
    progress: Progress
    has_tasks: bool

class PhaseView(BaseModel):
    name: str
    goal: str
    start_week: int
    end_week: int
    deliverables: list[str]
    epics: list[EpicView]
    progress: Progress

class RoadmapView(BaseModel):
    phases: list[PhaseView]
    progress: Progress                    # whole project, including tasks without an epic
    current_week: int | None              # None until the board exists
    current_phase: str | None
    overdue: bool

class MethodologyView(BaseModel):
    decision: MethodologyDecision         # from domain/plan.py, fields not copied
    chosen_by: Literal["leader", "agents"]

class PlanViews(BaseModel):
    roadmap: StageView[RoadmapView]
    methodology: StageView[MethodologyView]
    architecture: StageView[Architecture] # from domain/plan.py as is
```

`MethodologyDecision`, `Architecture` and `Roadmap` are reused from `domain/plan.py`, so the views follow any schema change in spec 002 (including the `rationale` field 002, T005 adds).

### Rules (`build_plan_views(project, proposals, tasks, today) -> PlanViews`)

- **Status of each view** (FR-002, FR-003):
  - `approved` if `project.plan` has the stage. Its content **always** comes from `project.plan`, which holds the final version.
  - Otherwise, `pending` if there's a pending `plan_stage` proposal for that stage.
  - Otherwise, `not_generated`.
  - The content of a pending, rejected or discarded proposal is never shown.
- **Origin**: the newest `approved` or `adjusted` proposal of the subject. `decision` is `auto` if `auto_approved`, `adjusted` if `status == "adjusted"`, and `leader` otherwise. `approved_at` is its `resolved_at`.
- **Progress** (FR-005): tasks grouped by `epic_key`; a task is done when `status == "done"`. A phase adds up its epics. The project total adds every task, including the ones without an epic or with an epic that no longer exists.
- **Current week** (FR-006): only when `project.status == "ready"`. The start is the `resolved_at` of the newest approved `sprints` proposal. `current_week = (today - start).days // 7 + 1`. If it's past the last `end_week`, the last week is used and `overdue = True`. `current_phase` is the first phase with `start_week <= week <= end_week`, or `None` if the week falls in a gap.
- **Who chose the methodology** (FR-007): `leader` if `project.requested_methodology != "auto"`, `agents` otherwise.

### Use case and API

- `GetPlanViews(uow, today: Callable[[], date])`: `uow.projects.get` (or `ProjectNotFound`), `uow.proposals.list_by_project` and `uow.tasks.list_by_project`, then `build_plan_views`. `today` is injected from `dependencies.py` (UTC date) so tests can pin it.
- `GET /api/projects/{id}/plan` → `200` + `PlanViews` · `404`.

## Decisions and alternatives

| Decision | Discarded alternative | Why |
|---|---|---|
| One endpoint with the three views | One endpoint per view | One request per screen (FR-001); the payload is small |
| `GET /api/projects/{id}/plan` | `GET /api/projects/{id}` returning a `ProjectDetail` (UC-07 diagram) | The project GET belongs to spec 001 and the board to 003; each view gets its own resource |
| Built by a pure domain function | Computed in the router or with SQL | Testable without a DB or HTTP; status and progress rules are business rules |
| Content from `project.plan` | The proposal's `final_content` | `project.plan` is the current version even after a replan changes it (008) |
| Plan start = approval of `sprints` | A new `plan_started_at` column | No migration; it's when the board gets built (003) |
| Reuse the schemas in `domain/plan.py` | Copy their fields into the view | They can't drift apart if 002 changes a schema |

## Risks

- **Depends on 002, 003 and 005**: without proposals or tasks, only `not_generated` works end to end. The pure function is tested earlier with hand-built data.
- **Replans**: if spec 008 changes the roadmap, the origin still shows the original stage approval. Agree with Mitchz01 whether `ApplyReplan` updates `project.plan["roadmap"]` and how its origin is shown.
- **Discarded tasks**: spec 003 has no "discarded" status. If 008 deletes them they stop counting on their own; if it marks them some other way, they must be filtered here.

---

## API Contract

Follows [plan/api-conventions.md](../../plan/api-conventions.md) (headers, error body, status codes). The API tests assert every status row below.

### `GET /api/projects/{id}/plan` — the three plan views (US1–US4)

No body. Read-only: it never writes anything (FR-009).

| Status | When | Body |
|---|---|---|
| `200` | The project exists, whatever its status (views that don't exist yet come back as `not_generated`) | `PlanViews` |
| `404` | Unknown project | Error `project_not_found` |

```json
{
  "roadmap": {
    "status": "approved",
    "origin": { "agent": "Product manager", "rationale": "…", "approved_at": "2026-10-23T14:20:00Z", "decision": "auto" },
    "content": {
      "phases": [
        {
          "name": "Foundations", "goal": "Base ready", "start_week": 1, "end_week": 2,
          "deliverables": ["Repo and CI"],
          "epics": [
            { "key": "EP-1", "title": "Setup", "description": "…", "has_tasks": true,
              "progress": { "tasks": 4, "tasks_done": 1, "points": 10, "points_done": 2 } }
          ],
          "progress": { "tasks": 8, "tasks_done": 1, "points": 21, "points_done": 2 }
        }
      ],
      "progress": { "tasks": 30, "tasks_done": 1, "points": 80, "points_done": 2 },
      "current_week": 2,
      "current_phase": "Foundations",
      "overdue": false
    }
  },
  "methodology": {
    "status": "approved",
    "origin": { "agent": "Agile coach", "rationale": "…", "approved_at": "…", "decision": "leader" },
    "content": { "decision": { /* MethodologyDecision */ }, "chosen_by": "agents" }
  },
  "architecture": { "status": "pending", "origin": null, "content": null }
}
```

- `status`: `not_generated` | `pending` | `approved`. `origin` and `content` are only set when `approved`; the content of pending or rejected proposals is never returned (FR-002, FR-003).
- `decision`: `leader` | `adjusted` | `auto`. `chosen_by`: `leader` (methodology requested) | `agents` (`auto`).
- `current_week` and `current_phase` are `null` until the board exists; `overdue` is `true` when today is past the last phase.
- `architecture.content` is `Architecture` and `methodology.content.decision` is `MethodologyDecision`, both as in `domain/plan.py`.

---

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Check that `backend/tests/fakes.py` (spec 001, T009) has `proposals` and `tasks` in `InMemoryUnitOfWork`; add them if missing

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: view models, the status rule and the endpoint

**⚠️ CRITICAL**: no user story work can begin until this phase is complete

- [x] T002 Create `backend/app/domain/plan_views.py` with `StageView`, `ViewStatus`, `Progress` and `PlanViews`, and `build_plan_views` with the status rule (`not_generated`, and `approved` from `project.plan`)
- [x] T003 [P] Status tests: project in draft (everything `not_generated`) and a stage in `project.plan` (`approved`), in `backend/tests/unit/domain/test_plan_views.py`
- [x] T004 Implement `GetPlanViews` in `backend/app/application/use_cases/projects/get_plan_views.py` and `GET /api/projects/{id}/plan` in `projects.py` (200, 404), with `today` injected from `dependencies.py`

**Checkpoint**: the endpoint answers with each view's status

---

## Phase 3: User Story 1 - See the roadmap and its progress (Priority: P1) 🎯 MVP

**Goal**: phases, epics, progress per epic and phase, and the current week

**Independent Test**: with the mock plan applied and two tasks of an epic done, the roadmap shows that epic and its phase with 2 done tasks and their points

### Tests for User Story 1

- [x] T005 [P] [US1] Progress tests: per epic, per phase, total including tasks without an epic, epic without tasks (`has_tasks = False`)
- [x] T006 [P] [US1] Current week tests with a pinned `today`: no board (`None`), week 2 after 10 days, `overdue`, a week in a gap between phases
- [x] T007 [P] [US1] API test with `MOCK_PLAN` stored in `project.plan` and tasks created by hand, in `backend/tests/integration/adapters/test_plan_views_api.py`

### Implementation for User Story 1

- [x] T008 [US1] Add `EpicView`, `PhaseView` and `RoadmapView` and the progress calculation in `backend/app/domain/plan_views.py`
- [x] T009 [US1] Add the current week, current phase and `overdue` calculation

**Checkpoint**: the roadmap can be drawn with its progress

---

## Phase 4: User Story 2 - See the methodology and why it was chosen (Priority: P1)

**Goal**: the approved methodology and who chose it

**Independent Test**: with the methodology approved, the view matches what was approved and has `chosen_by`

### Tests for User Story 2

- [x] T010 [P] [US2] Tests: recommended by the agents (`requested_methodology = "auto"`) and chosen by the leader (`"kanban"`)

### Implementation for User Story 2

- [x] T011 [US2] Add `MethodologyView` and `chosen_by` in `build_plan_views`

---

## Phase 5: User Story 3 - See the architecture and its decisions (Priority: P2)

**Goal**: the approved architecture, in the approved order

**Independent Test**: with 4 components and 3 decisions approved, the view has all of them in the same order

### Tests for User Story 3

- [x] T012 [P] [US3] Architecture view test (components, stack and decisions in order)

### Implementation for User Story 3

- [x] T013 [US3] Build `StageView[Architecture]` from `project.plan["architecture"]`

---

## Phase 6: User Story 4 - Know where each view comes from (Priority: P2)

**Goal**: origin (agent, rationale, date and how it was approved) and the `pending` status

**Independent Test**: with analysis and methodology approved and architecture pending, the methodology has its origin, the architecture says `pending` with no content and the roadmap `not_generated`

### Tests for User Story 4

- [x] T014 [P] [US4] Origin tests: `leader`, `adjusted` and `auto`; the newest approved one wins after earlier rejections; a pending proposal never shows content; an approved stage with a new pending proposal stays `approved`

### Implementation for User Story 4

- [x] T015 [US4] Add `ViewOrigin`, the `pending` status and picking the newest approved proposal of the subject in `build_plan_views`

**Checkpoint**: all user stories work independently

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T016 Run the full `pytest`, including `test_layers.py`
- [x] T017 [P] Update the UC-07 diagram in [plan/use-cases.md](../../plan/use-cases.md) (`GET /api/projects/{id}/plan`, `GetPlanViews`)
- [x] T018 Measure the response time with 50 tasks (SC-001) and check the scenarios by hand in mock mode

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational** needs `project.plan` (written by 002's `AdvancePlanning`) and spec 001's `projects.py` router.
- **Polish** after the desired stories.

### User Story Dependencies

- **US1 (P1)**: needs tasks (003) for real progress; the pure function is tested earlier with hand-built tasks
- **US2 (P1)** and **US3 (P2)**: only Foundational
- **US4 (P2)**: needs `ProposalRepository.list_by_project` (002) and the 005 statuses

### Cross-spec dependencies

- **001**: `projects.py` router, `ProjectNotFound` and `requested_methodology`.
- **002** (Mitchz01): `Roadmap`, `MethodologyDecision` and `Architecture` in `domain/plan.py`; `project.plan[stage]` holds the final version.
- **003** (codigotpx): `Task.epic_key`, `points` and `status == "done"`; `project.status == "ready"` once the board exists. 003's plan mentions a visual direction shared with 004 (T032); that's frontend, out of this plan.
- **005**: proposals with `resolved_at`, `auto_approved` and `status`.
- **008** (Mitchz01): whether a replan changes `project.plan["roadmap"]`, and how tasks are discarded.

### Within Each User Story

- Pure-function tests first (cheap), then use case and API
- Tests marked `[P]` can be written in parallel

## Notes

- [Story] labels map tasks to user stories for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group, and check the box here
- Out of scope: screens and drawing the roadmap (frontend), and editing the plan from the views
