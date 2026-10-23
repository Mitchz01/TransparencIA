# Implementation Plan: 002 · Agent planning pipeline

**Date**: 2026-10-23  
**Spec**: [spec.md](spec.md)  
**Status**: Draft

## Summary

Replace the back-to-back `RunPlanning` with a per-stage pipeline whose state lives in the DB: `StartPlanning` launches the first pending stage in the background, `RunPlanningStep` runs one agent and stores its output as a `pending` `Proposal`, and `AdvancePlanning` decides what happens when a proposal is resolved (next stage, redo with the rejection reason, or plan completed). Auto-approve resolves each proposal right away. Outputs are validated twice: by the Pydantic schema and by domain consistency rules (stories in existing epics, each story in exactly one iteration, capacity, requested methodology); an invalid output is retried once before the stage fails. Progress is published on the `EventBus` and streamed over SSE.

This plan also builds pieces other specs reuse: `Proposal` persistence, the background runner, the shared capacity rule and the SSE endpoint.

## Technical Context

**Language/Version**: Python 3.13 (backend), TypeScript 6 + React 19 (frontend)  
**Primary Dependencies**: FastAPI, Pydantic, SQLModel, Google ADK 2.12 + Gemini (`gemini-3.5-flash`), sse-starlette  
**Storage**: SQLite; new `proposal` table; approved stage outputs in `project.plan` (JSON)  
**Testing**: pytest with `MockPlanningAgents` and scripted fake agents; `InMemoryUnitOfWork` from `backend/tests/fakes.py`  
**Target Platform**: local dev server, Cloud Run as the deployment target  
**Project Type**: web (backend + frontend)  
**Performance Goals**: full plan with auto-approve in < 3 min (SC-001); `agent_started` reaches the UI in < 2 s (SC-002)  
**Constraints**: agent calls never run inside the HTTP request (202 + background task with its own DB session); hexagonal dependency rule; works without a key (FR-015)  
**Scale/Scope**: 6 stages per project, 3–5 member teams, one active run per project

## Project Structure

### Documentation (this feature)

```text
specs/002-agent-planning-pipeline/
├── plan.md              # This file
└── spec.md              # Feature spec
```

### Source Code (repository root)

```text
backend/app/
├── domain/
│   ├── plan.py                          # + rationale on every schema, stage lookups, validate_stage_output()
│   ├── capacity.py                      # NEW: capacity rule shared with spec 003
│   ├── proposals.py                     # + rejection_reason, reject(reason)
│   ├── events.py                        # + StageNeedsLeader, PlanCompleted
│   └── errors.py                        # + PlanningAlreadyRunning, PlanningNotStartable
├── application/
│   ├── ports/unit_of_work.py            # + proposals
│   └── use_cases/planning/
│       ├── context.py                   # project_context() + build_stage_context()
│       ├── start_planning.py
│       ├── run_planning_step.py
│       └── advance_planning.py          # contract with spec 005 (approve/adjust/reject)
│       (run_planning.py is removed)
└── adapters/
    ├── inbound/http/
    │   ├── background.py                # NEW: spawn() for background use cases
    │   ├── planning.py                  # POST /planning, GET /events (SSE)
    │   └── dependencies.py              # + uow_factory, planning providers
    └── outbound/
        ├── persistence/tables.py, mappers.py, repositories.py, unit_of_work.py   # + ProposalTable
        └── agents/
            ├── adk/prompts.py           # + feedback and capacity instructions
            └── mock/data.py             # + rationale fields

backend/tests/
├── unit/domain/test_plan_validation.py, test_capacity.py
├── unit/application/test_start_planning.py, test_run_planning_step.py, test_advance_planning.py
└── integration/adapters/test_planning_api.py, test_persistence.py

frontend/src/
├── domain/plan.ts, events.ts, rules.ts  # + rationale, new events, capacity mirror
├── application/ports.ts                 # + PlanningGateway, EventStream
├── application/use-cases/usePlanning.ts, useProjectEvents.ts
├── adapters/http/planningGateway.ts, eventStream.ts
├── adapters/fake/planningGateway.ts, eventStream.ts
└── ui/
    ├── pages/PlanningPage.tsx
    └── components/planning/StageStepper.tsx
```

**Structure Decision**: web application on the existing hexagonal layout. Stage definitions stay in `domain/plan.py` (`PLANNING_STAGES`), so the `PlanningAgents` port keeps its single `run_stage` method; orchestration lives in `application/use_cases/planning/`.

## API Contract

Follows [plan/api-conventions.md](../../plan/api-conventions.md) (headers, error body, status codes). The API tests assert every status row below.

New domain errors (with T008): `StageNotRetryable`, plus `stage_not_found` for unknown stage keys.

Approving, adjusting and rejecting proposals is spec 005's API; this spec only starts and resumes the pipeline and streams its progress. Until 005 lands, auto-approve covers the demo.

### Shared shapes

**Proposal** (also returned by spec 005)

```json
{
  "id": 41,
  "project_id": 12,
  "kind": "plan_stage",
  "key": "methodology",
  "agent": "Agile coach",
  "content": { /* output schema of the stage */ },
  "rationale": "Small team with high uncertainty…",
  "status": "pending",
  "adjusted_content": null,
  "rejection_reason": null,
  "auto_approved": false,
  "created_at": "2026-10-23T14:06:10Z",
  "resolved_at": null
}
```

`kind`: `plan_stage` | `document` | `replan` | `github_action`. `status`: `pending` | `approved` | `adjusted` | `rejected` (spec 008 adds `discarded`).

### `POST /api/projects/{id}/planning` — start or resume planning (US1, US5)

No body (`Content-Type` not required). Starts from the first stage without an approved proposal, so after an error it resumes instead of starting over (FR-016).

| Status | When | Body |
|---|---|---|
| `202` | Accepted; the first pending stage runs in the background | `{"project_id": 12, "status": "planning", "stage": "analysis"}` |
| `404` | Unknown project | Error `project_not_found` |
| `409` | Already planning | Error `planning_already_running` |
| `409` | Project is `ready` (plan already completed; use replan, spec 008) | Error `planning_not_startable` |

### `POST /api/projects/{id}/planning/stages/{key}/retry` — rerun a capped stage (US4)

No body. `key` is a stage key (`analysis`, `methodology`, `architecture`, `roadmap`, `backlog`, `sprints`). Used after three consecutive rejections, when the stage waits for the leader (`stage_needs_leader`).

| Status | When | Body |
|---|---|---|
| `202` | The stage runs again in the background, with the last rejection as feedback | `{"project_id": 12, "status": "planning", "stage": "methodology"}` |
| `404` | Unknown project | Error `project_not_found` |
| `404` | Unknown stage key | Error `stage_not_found` |
| `409` | The stage isn't waiting for the leader (it's running, pending approval or already approved) | Error `stage_not_retryable` |

### Events on `GET /api/projects/{id}/events` (SSE, UC-14)

The endpoint (headers, status codes, replay with `Last-Event-ID`) is spec 005's contract. If this plan lands first, T009 creates it with the same contract. Each message is `id: <seq>` + `event: <type>` + `data: <json>`; spec 005 adds the common fields (`seq`, `occurred_at`, `actor`, `summary`, `ref`). Events this spec publishes:

| `event` | `data` |
|---|---|
| `agent_started` | `{"project_id", "agent": "methodology", "title": "Agile coach"}` |
| `agent_finished` | `{"project_id", "agent", "title", "output": { … }}` |
| `proposal_created` | `{"project_id", "proposal_id"}` |
| `proposal_resolved` | `{"project_id", "proposal_id", "status"}` |
| `stage_needs_leader` | `{"project_id", "stage": "methodology", "rejections": 3}` |
| `plan_failed` | `{"project_id", "agent", "error": "message safe to show"}` |
| `plan_completed` | `{"project_id"}` |

Other specs add their own types (`plan_applied`, `task_status_changed`, `team_changed`…) on the same stream; the client ignores types it doesn't know.

```text
id: 1520
event: agent_started
data: {"seq":1520,"type":"agent_started","project_id":12,"agent":"analysis","title":"Product analyst"}

: ping
```

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: wiring for background work and per-task DB sessions

- [ ] T001 Create `backend/app/adapters/inbound/http/background.py` with `spawn(coro)`: `asyncio.create_task`, keeps a reference in a module-level set until done, logs unhandled exceptions
- [ ] T002 Add `get_uow_factory()` to `backend/app/adapters/inbound/http/dependencies.py`: returns a callable that opens `SqlUnitOfWork(Session(engine))`, so background use cases never reuse the request's session

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: proposal persistence, rationale on every output, shared capacity rule

**⚠️ CRITICAL**: no user story work can begin until this phase is complete

- [ ] T003 Add `rejection_reason: str | None` and `reject(reason: str)` to `backend/app/domain/proposals.py`; update `backend/tests/unit/domain/test_proposals.py`
- [ ] T004 Add `ProposalTable` to `backend/app/adapters/outbound/persistence/tables.py`, its mappers, `SqlProposalRepository` (get, list_by_project, add, save) and `proposals` on `SqlUnitOfWork` and the `UnitOfWork` port
- [ ] T005 [P] Add a required `rationale: str` field (2–3 sentences, "why you decided this") to `Analysis`, `Architecture`, `Roadmap`, `Backlog` and `SprintPlanning` in `backend/app/domain/plan.py`; add it to `backend/app/adapters/outbound/agents/mock/data.py` and to `frontend/src/domain/plan.ts`
- [ ] T006 [P] Create `backend/app/domain/capacity.py`: `HOURS_PER_POINT = {"junior": 8, "mid": 6, "senior": 4}`, `member_capacity(member, sprint_weeks)` and `team_capacity(members, sprint_weeks)` in points; mirror it in `frontend/src/domain/rules.ts`. This is the single capacity rule (spec 003, FR-017)
- [ ] T007 [P] Add `stage_by_key()`, `next_stage()` and `first_pending_stage(approved_keys)` to `backend/app/domain/plan.py`
- [ ] T008 Add `PlanningAlreadyRunning` and `PlanningNotStartable` (409) to `backend/app/domain/errors.py` and the HTTP error mapping; add `StageNeedsLeader(stage, rejections)` and `PlanCompleted` to `backend/app/domain/events.py`
- [ ] T009 Create `backend/app/adapters/inbound/http/planning.py` with `GET /api/projects/{id}/events`: SSE (`sse-starlette`) over `EventBus.subscribe`, one `event:` per `DomainEvent.type`. It's the UC-14 transport; spec 005 builds the activity UI on top of it

**Checkpoint**: proposals persist, and every stage output carries a rationale

---

## Phase 3: User Story 1 - Generate the plan by stages (Priority: P1) 🎯 MVP

**Goal**: six stages in order, each one a proposal; the next starts when the previous is approved; auto-approve runs them back to back

**Independent Test**: create a project with auto-approve, POST `/planning`; six approved proposals exist in order, each with its rationale

### Tests for User Story 1

- [ ] T010 [P] [US1] `StartPlanning` tests (status → planning, rejects when already planning or ready, picks the first pending stage) in `backend/tests/unit/application/test_start_planning.py`
- [ ] T011 [P] [US1] `RunPlanningStep` tests (context only has `stage.inputs` with final content; pending proposal saved; `AgentStarted`/`AgentFinished`/`ProposalCreated` published; auto-approve chains to the next stage) in `backend/tests/unit/application/test_run_planning_step.py`
- [ ] T012 [P] [US1] `AdvancePlanning` tests (approved → `project.plan[key]` saved and next stage runs; adjusted content is what the next stage receives; last stage → `PlanCompleted` and completion handlers called) in `backend/tests/unit/application/test_advance_planning.py`
- [ ] T013 [P] [US1] API test: `POST /api/projects/{id}/planning` returns 202 and, with mock agents and auto-approve, the project ends with six approved proposals, in `backend/tests/integration/adapters/test_planning_api.py`

### Implementation for User Story 1

- [ ] T014 [US1] Move `_project_context` from `run_planning.py` to `backend/app/application/use_cases/planning/context.py` and add `build_stage_context(stage, project, proposals)`, which takes the `final_content` of the latest approved or adjusted proposal per key
- [ ] T015 [US1] Implement `RunPlanningStep` in `backend/app/application/use_cases/planning/run_planning_step.py`: publish `AgentStarted`, call `agents.run_stage`, save a `pending` `plan_stage` proposal (`agent` = stage title, `rationale` from the output), publish `AgentFinished` + `ProposalCreated`; if `project.auto_approve`, `approve(auto=True)` and call `AdvancePlanning`
- [ ] T016 [US1] Implement `AdvancePlanning` in `backend/app/application/use_cases/planning/advance_planning.py`: entry point `on_proposal_resolved(proposal_id)`; for approved/adjusted, store the final content in `project.plan[stage.key]` and run the next stage, or, after `sprints`, publish `PlanCompleted` and call the `on_plan_completed` handlers (spec 003's `ApplyPlan`, spec 006's `GenerateDocuments`)
- [ ] T017 [US1] Implement `StartPlanning` in `backend/app/application/use_cases/planning/start_planning.py` (FR-013, FR-016): only from `draft` or `error`, set `planning`, run `first_pending_stage`
- [ ] T018 [US1] Add `POST /api/projects/{id}/planning` (202, `spawn`) to `backend/app/adapters/inbound/http/planning.py`; wire `StartPlanning`, `RunPlanningStep` and `AdvancePlanning` in `dependencies.py`; include the router in `backend/app/main.py`
- [ ] T019 [US1] Remove `backend/app/application/use_cases/planning/run_planning.py`, its provider and `backend/tests/unit/application/test_run_planning.py` (their assertions move to T011)
- [ ] T020 [P] [US1] Add `PlanningGateway.start()` and `EventStream` to `frontend/src/application/ports.ts`; implement them in `frontend/src/adapters/http/planningGateway.ts` and `frontend/src/adapters/http/eventStream.ts` (`EventSource`, reconnect + refetch), plus fakes in `frontend/src/adapters/fake/`
- [ ] T021 [US1] Create `useProjectEvents` and `usePlanning` in `frontend/src/application/use-cases/`, and `PlanningPage` with `StageStepper` (six stages: waiting, working, pending approval, approved, failed) in `frontend/src/ui/`; route `/projects/:id/planning`. Spec 005 adds the proposal cards to this page

**Checkpoint**: with auto-approve, the plan is generated end to end through the API and the stepper shows each agent live

---

## Phase 4: User Story 2 - Methodology recommended or respected (Priority: P1)

**Goal**: the requested methodology is respected; with "auto", a recommendation with at least two discarded alternatives

**Independent Test**: plan the same project with `auto` and with `kanban` and compare the methodology proposals

### Tests for User Story 2

- [ ] T022 [P] [US2] Validation tests (output differs from a non-auto `requested_methodology` → invalid; fewer than 2 alternatives with `auto` → invalid) in `backend/tests/unit/domain/test_plan_validation.py`

### Implementation for User Story 2

- [ ] T023 [US2] Add `validate_stage_output(stage_key, output, context) -> list[str]` to `backend/app/domain/plan.py`, starting with the methodology rules
- [ ] T024 [US2] In `RunPlanningStep`, run `validate_stage_output` after the schema check; on issues, retry the stage once passing them as `feedback`, then fail the stage (edge case "wrong format")
- [ ] T025 [US2] Tighten the `methodology` prompt in `backend/app/adapters/outbound/agents/adk/prompts.py` (respect the requested one, at least two alternatives with `why_not`)

**Checkpoint**: User Stories 1 and 2 work independently

---

## Phase 5: User Story 3 - A realistic plan for the team (Priority: P2)

**Goal**: every story assigned to a real member with a suitable role, in exactly one iteration, without exceeding capacity

**Independent Test**: team of 3 at 10 h/week; no iteration exceeds `team_capacity` and every story has an owner from the team

### Tests for User Story 3

- [ ] T026 [P] [US3] Unit tests for `capacity.py` in `backend/tests/unit/domain/test_capacity.py`
- [ ] T027 [P] [US3] Validation tests for `backlog` (every story in an existing epic) and `sprints` (each story exactly once, assignments to real members, points per iteration ≤ capacity) in `backend/tests/unit/domain/test_plan_validation.py`

### Implementation for User Story 3

- [ ] T028 [US3] Add a derived `capacity` input to the `sprints` stage in `PLANNING_STAGES` (points per member and per iteration, from `capacity.py` and `sprint_length_weeks`) and build it in `context.py`
- [ ] T029 [US3] Extend `validate_stage_output` with the backlog and sprints rules (FR-009, FR-010)
- [ ] T030 [US3] Update the `backlog` and `sprints` prompts to use `capacity` and the exact member names

**Checkpoint**: User Stories 1–3 work independently

---

## Phase 6: User Story 4 - Redo a rejected stage (Priority: P2)

**Goal**: rejecting with a reason redoes the stage automatically; after 3 rejections in a row, wait for the leader

**Independent Test**: reject the roadmap with "it's 4 weeks, not 8"; a new roadmap proposal appears without other actions and the old one stays as rejected with its reason

### Tests for User Story 4

- [ ] T031 [P] [US4] `AdvancePlanning` tests: rejected → the same stage runs with `feedback = {reason, rejected_content}`; third consecutive rejection → no rerun and `StageNeedsLeader` published; an approval resets the count, in `backend/tests/unit/application/test_advance_planning.py`

### Implementation for User Story 4

- [ ] T032 [US4] Handle rejected proposals in `AdvancePlanning`: count consecutive rejections of that stage key since its last approval; below 3, rerun the stage with `feedback`; otherwise publish `StageNeedsLeader`
- [ ] T033 [US4] Let `build_stage_context` include an optional `feedback` key and add to `COMMON` in `prompts.py`: "If the context has `feedback`, the leader rejected your previous proposal: fix it following the reason"
- [ ] T034 [US4] Add `POST /api/projects/{id}/planning/stages/{key}/retry` (202) so the leader can rerun a capped stage; `StageStepper` shows the "needs you" state with a retry button

**Checkpoint**: User Stories 1–4 work independently

---

## Phase 7: User Story 5 - Recover from an agent error (Priority: P3)

**Goal**: a failed stage leaves the project in `error` with the stage name, and retrying only reruns that stage

**Independent Test**: make the backlog stage fail, POST `/planning` again; analysis, methodology, architecture and roadmap aren't regenerated

### Tests for User Story 5

- [ ] T035 [P] [US5] Tests: agent exception → `project.status = error`, `PlanFailed(agent, error)` published; restart from `error` runs only the first unapproved stage, in `backend/tests/unit/application/test_run_planning_step.py` and `test_start_planning.py`

### Implementation for User Story 5

- [ ] T036 [US5] Catch agent and validation failures in `RunPlanningStep` after the retry: set `error`, publish `PlanFailed`, commit
- [ ] T037 [US5] Show the failed stage and a "Retry" button in `StageStepper` (calls `PlanningGateway.start()`)

**Checkpoint**: all user stories work independently

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T038 [P] Check that the mock run (`MOCK_AGENTS=1`) covers the whole demo: project → plan → board (SC-006)
- [ ] T039 [P] Log stage duration and retries in `RunPlanningStep` to check SC-001 against Gemini
- [ ] T040 Update `plan/use-cases.md` (UC-03) if the implementation drifted, and the README TODO list

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → **Foundational (Phase 2)** → user stories
- **US1** is the MVP; US2 and US3 extend `RunPlanningStep`'s validation; US4 and US5 extend `AdvancePlanning` and `RunPlanningStep` error handling
- **Polish** after the desired stories

### User Story Dependencies

- **US1 (P1)**: after Foundational
- **US2 (P1)**: needs `RunPlanningStep` (US1) for the retry hook; independently testable with a scripted fake agent
- **US3 (P2)**: same hook as US2; also needs T006
- **US4 (P2)**: needs `AdvancePlanning` (US1)
- **US5 (P3)**: needs `RunPlanningStep` and `StartPlanning` (US1)

### Cross-spec dependencies

- **001 → 002**: reads `Project` and its members; `_project_context` already excludes ids, status and auto-approve.
- **002 → 005 (contract)**: spec 005's approve/adjust/reject use cases resolve the proposal and then call `AdvancePlanning.on_proposal_resolved(proposal_id)` for `plan_stage` proposals. Until 005 exists, auto-approve covers the demo.
- **002 → 003**: `ApplyPlan` is registered as an `on_plan_completed` handler. Capacity comes from `domain/capacity.py` (T006) in both specs.
- **002 → 006**: `GenerateDocuments` is registered as an `on_plan_completed` handler and reuses `RunPlanningStep`.
- **SSE (T009)**: shared with spec 005. If 005 lands first with the endpoint, skip T009.

### Within Each User Story

- Domain rules before use cases
- Use cases before endpoints
- Endpoint before UI

## Notes

- [Story] labels map tasks to user stories for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group, and check the box here
- Avoid: vague tasks, editing the same file from two parallel tasks, cross-story dependencies that break independence
