# Implementation Plan: 008 · GitHub sync and replanning

**Date**: 2026-10-23  
**Spec**: [spec.md](spec.md)  
**Status**: Draft

## Summary

Two halves. **Sync**: a signed GitHub webhook endpoint parses PR and issue events into domain events, deduplicates them by delivery id, ignores the ones caused by the system's own writes, and applies the state rules (never out of `done` except on reopen; merge completes the checklist) without a proposal; objectives close when all their tasks are done, whether the last task moved through GitHub or by hand. **Replanning**: a new `replan` agent stage receives the approved plan, the team, the current board, the real velocity and a reason, and returns a list of changes (move, reassign, add, discard), each with its rationale. It runs on demand or automatically on drift (sprint closed with pending work, relevant team change); automatic replans never auto-approve. Approving applies the changes in one transaction, discarding the stale ones and reporting them.

## Technical Context

**Language/Version**: Python 3.13 (backend), TypeScript 6 + React 19 (frontend)  
**Primary Dependencies**: FastAPI, Pydantic, SQLModel, Google ADK + Gemini (replan stage); `hmac`/`hashlib` from the standard library  
**Storage**: SQLite; new `webhook_delivery` table; `closed` and `end_date` on `sprint`; `origin` on `proposal`  
**Testing**: pytest with recorded GitHub payloads as fixtures, `FakeCodeHost`, mock and scripted agents; `tsc -b`  
**Target Platform**: local dev server (webhooks through a tunnel), Cloud Run as the deployment target  
**Project Type**: web (backend + frontend)  
**Performance Goals**: a GitHub change shows on the board in < 10 s (SC-001); replan proposal in < 60 s (SC-003)  
**Constraints**: the webhook answers 202 fast and processes in the background; processing is idempotent (FR-003); done tasks are never modified by a replan (FR-011)  
**Scale/Scope**: one repo per project; tens of events per day

## Project Structure

### Documentation (this feature)

```text
specs/008-github-sync-replanning/
├── plan.md              # This file
└── spec.md              # Feature spec
```

### Source Code (repository root)

```text
backend/app/
├── domain/
│   ├── sync.py                          # NEW: GitHub event types + next_status() rules
│   ├── board.py                         # + Sprint.closed/end_date, objectives_to_close()
│   ├── plan.py                          # + ReplanChange, Replan schemas, REPLAN_STAGE, validate_replan()
│   ├── proposals.py                     # + origin ("leader" | "automatic"), status "discarded"
│   └── events.py                        # + ObjectiveClosed, SprintClosed, ReplanApplied, GithubEventIgnored
├── application/
│   ├── ports/repositories.py            # + WebhookDeliveryRepository
│   └── use_cases/
│       ├── integrations/handle_github_event.py
│       ├── board/evaluate_objectives.py, close_sprint.py
│       └── planning/replan.py, apply_replan.py, propose_replan_on_drift.py
└── adapters/
    ├── inbound/webhooks/github.py       # POST /webhooks/github
    ├── inbound/http/planning.py         # + POST /api/projects/{id}/replan
    ├── inbound/http/board.py            # + POST /api/sprints/{id}/close
    └── outbound/
        ├── persistence/                 # WebhookDeliveryTable, new columns
        └── agents/adk/prompts.py, mock/data.py   # + replan

backend/tests/
├── fixtures/github/*.json               # pull_request opened/ready/merged, issues closed/reopened
├── unit/domain/test_sync_rules.py, test_replan_validation.py
├── unit/application/test_handle_github_event.py, test_evaluate_objectives.py,
│                     test_replan.py, test_apply_replan.py, test_propose_replan_on_drift.py
└── integration/adapters/test_github_webhook.py

frontend/src/
├── domain/plan.ts, board.ts, events.ts  # + Replan types, sprint closed, new events
├── application/ports.ts                 # + PlanningGateway.replan(), BoardGateway.closeSprint()
└── ui/components/
    ├── planning/ReplanDialog.tsx
    ├── proposals/ReplanDiff.tsx         # rendered inside spec 005's proposal card
    └── board/ObjectiveBadge.tsx, CloseSprintButton.tsx
```

**Structure Decision**: web application on the existing hexagonal layout. Webhook parsing lives in the inbound adapter and only produces domain events (`domain/sync.py`); the status rules are pure functions, so they're tested without HTTP or a DB.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: test fixtures and entity fields

- [ ] T001 [P] Save sample GitHub webhook payloads (`pull_request` opened, ready_for_review, closed+merged; `issues` closed completed, closed not_planned, reopened) in `backend/tests/fixtures/github/`
- [ ] T002 Add `closed: bool` and `end_date: date | None` to `Sprint` in `backend/app/domain/board.py` (spec 003's `ApplyPlan` fills `end_date` from the approval date and `sprint_length_weeks`), `origin` and the `discarded` status to `Proposal` in `backend/app/domain/proposals.py`, and the matching columns in `tables.py`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: webhook endpoint, event parsing and idempotency

**⚠️ CRITICAL**: no user story work can begin until this phase is complete

- [ ] T003 Define the GitHub domain events in `backend/app/domain/sync.py`: `PullRequestOpened(repo, number, author, closes, draft)`, `PullRequestReadyForReview`, `PullRequestMerged`, `IssueClosed(repo, number, reason)`, `IssueReopened`
- [ ] T004 Add `WebhookDeliveryTable` and `WebhookDeliveryRepository` (`seen(delivery_id)`, `add`) with `deliveries` on the `UnitOfWork` port, `SqlUnitOfWork` and `backend/tests/fakes.py`
- [ ] T005 Create `backend/app/adapters/inbound/webhooks/github.py`: `POST /webhooks/github` verifies `X-Hub-Signature-256` against `GITHUB_WEBHOOK_SECRET` with `hmac.compare_digest` (401 if invalid), maps `X-GitHub-Event` + action to the domain events, answers 202 and processes in the background with `spawn`; include it in `main.py`

**Checkpoint**: signed events reach a use case, and unsigned ones are rejected

---

## Phase 3: User Story 1 - The board moves forward with GitHub (Priority: P1) 🎯 MVP

**Goal**: PR and issue events move linked tasks according to the spec table, without a proposal

**Independent Test**: with a connected repo and published issues, open and merge a PR that closes an issue; the task goes through "in progress" and "done" without touching the board

### Tests for User Story 1

- [ ] T006 [P] [US1] `next_status(current, event)` tests for every row of the spec table, plus "never out of done except reopen" and "not planned → no change", in `backend/tests/unit/domain/test_sync_rules.py`
- [ ] T007 [P] [US1] `HandleGithubEvent` tests (unknown repo or unlinked issue → ignored; same delivery twice → applied once; event matching an `OwnWrite` → ignored and consumed; merge completes the checklist; PR closing two issues moves both; `TaskStatusChanged` published) in `backend/tests/unit/application/test_handle_github_event.py`
- [ ] T008 [P] [US1] Webhook API tests (valid signature → 202; invalid → 401 and no change; fixtures end to end with `FakeCodeHost`) in `backend/tests/integration/adapters/test_github_webhook.py`

### Implementation for User Story 1

- [ ] T009 [US1] Implement `next_status()` in `backend/app/domain/sync.py`
- [ ] T010 [US1] Implement `HandleGithubEvent` in `backend/app/application/use_cases/integrations/handle_github_event.py`: dedupe by delivery id, find the project by repository and tasks by `ExternalLink` (spec 007), skip events matching an `OwnWrite` (FR-015), apply `next_status`, complete the checklist on merge, update the link state, commit, publish events; "not planned" closes publish `GithubEventIgnored` for the activity feed
- [ ] T011 [US1] Route `pull_request.opened` to spec 007's `ProposeReview` as well (if 007 isn't merged yet, leave the call behind a no-op default)

**Checkpoint**: GitHub progress shows up live on the board

---

## Phase 4: User Story 2 - Replan on demand (Priority: P1)

**Goal**: the leader asks for a replan with a reason and gets a list of changes with rationale; approving applies them together; done tasks are never touched

**Independent Test**: with an applied plan, remove a member, ask for a replan; the proposal reassigns their pending tasks, and approving changes the board in one step

### Tests for User Story 2

- [ ] T012 [P] [US2] `validate_replan` tests (rejects changes to done tasks, unknown task keys, unknown members or sprints) in `backend/tests/unit/domain/test_replan_validation.py`
- [ ] T013 [P] [US2] `Replan` tests (context = approved plan + team + board + velocity + reason; one retry on invalid output; a new request supersedes the pending one, merging reasons, old one `discarded`; leader replans follow auto-approve) in `backend/tests/unit/application/test_replan.py`
- [ ] T014 [P] [US2] `ApplyReplan` tests (all changes in one transaction; adjusted proposal with removed changes; stale changes discarded and reported in `ReplanApplied`; follow-up handlers called) in `backend/tests/unit/application/test_apply_replan.py`

### Implementation for User Story 2

- [ ] T015 [US2] Add `ReplanChange(kind: move|reassign|add|discard, task_key, to_sprint, to_member, new_story, expected_status, rationale)`, `Replan(changes, rationale)`, `REPLAN_STAGE` (inputs: project, plan, board, velocity, reason) and `validate_replan()` to `backend/app/domain/plan.py`; add the prompt and a mock output
- [ ] T016 [US2] Implement `Replan(project_id, reason, origin)` in `backend/app/application/use_cases/planning/replan.py`: build the context (velocity = done points per closed sprint), run the stage with one retry, supersede any pending replan (FR-014), create the `replan` proposal with `origin`, auto-approve only when `origin == "leader"` (FR-016)
- [ ] T017 [US2] Implement `ApplyReplan(proposal_id)` in `backend/app/application/use_cases/planning/apply_replan.py`: apply the final content's changes in one UoW, skip changes whose task isn't in `expected_status`, publish `ReplanApplied(applied, discarded)`; then call the follow-ups: spec 007's `ProposeIssues` for added tasks and `CloseDiscardedIssue` for discarded ones, spec 006's `MarkDocumentsOutdated`
- [ ] T018 [US2] Add `POST /api/projects/{id}/replan` (`{reason}`, 202) to `backend/app/adapters/inbound/http/planning.py`
- [ ] T019 [US2] Create `ReplanDialog` (reason, from the board header) and `ReplanDiff` (changes grouped by kind, each with its rationale and a checkbox to drop it before approving, for spec 005's proposal card)

**Checkpoint**: User Stories 1 and 2 work independently

---

## Phase 5: User Story 3 - Objectives that close by themselves (Priority: P2)

**Goal**: an objective is met when all its tasks are done, from GitHub or by hand

**Independent Test**: complete the last pending task of an objective (either way); the objective is met and the activity feed shows it

### Tests for User Story 3

- [ ] T020 [P] [US3] `objectives_to_close` and `EvaluateObjectives` tests (closes when all done; reopens if a task leaves done; `ObjectiveClosed` published) in `backend/tests/unit/application/test_evaluate_objectives.py`

### Implementation for User Story 3

- [ ] T021 [US3] Implement `objectives_to_close(objectives, tasks)` in `backend/app/domain/board.py` and `EvaluateObjectives(project_id, task_ids)` in `backend/app/application/use_cases/board/evaluate_objectives.py`
- [ ] T022 [US3] Call `EvaluateObjectives` from `HandleGithubEvent` and register it as an `after_task_changed` handler of spec 003's `MoveTask`
- [ ] T023 [US3] Show `ObjectiveBadge` (met / in progress) next to each sprint in the board

**Checkpoint**: User Stories 1–3 work independently

---

## Phase 6: User Story 4 - Detect drift (Priority: P3)

**Goal**: closing a sprint with pending work, or a relevant team change, proposes a replan by itself, which always waits for the leader

**Independent Test**: close a sprint with 3 unfinished tasks; a replan proposal mentioning them appears by itself

### Tests for User Story 4

- [ ] T024 [P] [US4] `CloseSprint` and `ProposeReplanOnDrift` tests (pending tasks → `Replan(origin="automatic")` with them in the reason; no pending → nothing; `TeamChanged` with joins, leaves, role, seniority or hours → replan; only renames or skills → nothing; never auto-approved) in `backend/tests/unit/application/test_propose_replan_on_drift.py`

### Implementation for User Story 4

- [ ] T025 [US4] Implement `CloseSprint(sprint_id)` in `backend/app/application/use_cases/board/close_sprint.py` and `POST /api/sprints/{id}/close`; publish `SprintClosed(pending_task_keys)`
- [ ] T026 [US4] Implement `ProposeReplanOnDrift` in `backend/app/application/use_cases/planning/propose_replan_on_drift.py` with two entry points: `on_sprint_closed` and `on_team_changed`; register the latter as an `on_team_changed` handler of spec 001's `UpdateProject`
- [ ] T027 [US4] Add `CloseSprintButton` to the sprint selector (shows the end date and a warning when it's past)

**Checkpoint**: all user stories work independently

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T028 [P] Prune `webhook_delivery` and consumed `own_write` rows older than 7 days on startup
- [ ] T029 [P] Add a dev-only `POST /api/dev/github-events` that replays a fixture through `HandleGithubEvent`, to demo sync without a tunnel
- [ ] T030 Update `plan/use-cases.md` (UC-12, UC-13) if the implementation drifted

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → **Foundational (Phase 2)** → user stories → **Polish**

### User Story Dependencies

- **US1 (P1)**: after Foundational; needs spec 007's `ExternalLink` and `OwnWrite`
- **US2 (P1)**: independent from US1; needs an applied board (spec 003) and spec 005's approval to call `ApplyReplan`
- **US3 (P2)**: needs spec 003's objectives; hooks into US1 and `MoveTask`
- **US4 (P3)**: reuses `Replan` (US2)

### Cross-spec dependencies

- **007 → 008 (contract)**: 007 creates `ExternalLink` and `OwnWrite` records and `ProposeReview`; 008 owns the webhook endpoint, dedupe and status rules, and calls `ProposeIssues` / `CloseDiscardedIssue` after a replan.
- **005 → 008 (contract)**: when a `replan` proposal is approved or adjusted, spec 005 calls `ApplyReplan(proposal_id)`; spec 005 owns the `discarded` status rendering and the "drop a change" adjust UI that `ReplanDiff` plugs into.
- **003 → 008**: objectives and `end_date` come from `ApplyPlan`; `EvaluateObjectives` is an `after_task_changed` handler of `MoveTask`.
- **001 → 008**: `ProposeReplanOnDrift.on_team_changed` is an `on_team_changed` handler of `UpdateProject`.
- **006**: `MarkDocumentsOutdated` runs after `ApplyReplan`.

### Within Each User Story

- Pure domain rules before use cases
- Use cases before endpoints
- Endpoint before UI

## Notes

- [Story] labels map tasks to user stories for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group, and check the box here
- Avoid: vague tasks, editing the same file from two parallel tasks, cross-story dependencies that break independence
