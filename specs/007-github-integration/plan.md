# Implementation Plan: 007 · GitHub integration

**Date**: 2026-10-23  
**Spec**: [spec.md](spec.md)  
**Status**: Approved

## Summary

Connect one GitHub repo per project, publish board tasks as issues through a `github_action` proposal, keep published issues in sync with task edits, close the issues of discarded tasks as "not planned", and propose code reviews (suggested reviewers + an agent-written review) when a PR that closes a project issue is opened. GitHub is reached through an extended `CodeHost` port with a real `GitHubCodeHost` (httpx) and the existing `FakeCodeHost` for tokenless demos. Every write the system makes is recorded as an `OwnWrite`, so the webhook handling of spec 008 can ignore the events those writes cause (FR-023).

## Technical Context

**Language/Version**: Python 3.13 (backend), TypeScript 6 + React 19 (frontend)  
**Primary Dependencies**: FastAPI, Pydantic, SQLModel, httpx (moves from dev to runtime requirements), Google ADK + Gemini for the reviewer agent  
**Storage**: SQLite; new `external_link` and `own_write` tables; `repository`, `github_token`, `webhook_id` on `project`; `github_username` on `member`  
**Testing**: pytest with `FakeCodeHost`; `GitHubCodeHost` tested with `httpx.MockTransport`; `tsc -b`  
**Target Platform**: local dev server (webhooks through a tunnel such as smee.io), Cloud Run as the deployment target  
**Project Type**: web (backend + frontend)  
**Performance Goals**: connect in < 1 min (SC-001); review proposal < 2 min after the PR opens (SC-003); task edits reach the issue in < 1 min (SC-006)  
**Constraints**: every new write to GitHub goes through an approved proposal (FR-019), except issue updates caused by human edits (FR-021); the token is never returned by the API; works without a token (FR-005)  
**Scale/Scope**: one repo per project, up to ~100 issues

## Project Structure

### Documentation (this feature)

```text
specs/007-github-integration/
├── plan.md              # This file
└── spec.md              # Feature spec
```

### Source Code (repository root)

```text
backend/app/
├── config.py                            # + PUBLIC_BASE_URL (webhook URL)
├── domain/
│   ├── project.py                       # + Member.github_username, Project.github_token, webhook_id
│   ├── integrations.py                  # + OwnWrite, RepoAccess, issue_body(), issue_labels(),
│   │                                    #   closing_refs(), pick_reviewers()
│   ├── plan.py                          # + CodeReview schema, CODE_REVIEW_STAGE
│   └── errors.py                        # + RepositoryNotAccessible, RepositoryNotConnected
├── application/
│   ├── ports/code_host.py               # extended (see Phase 2)
│   ├── ports/repositories.py            # + ExternalLinkRepository, OwnWriteRepository
│   └── use_cases/integrations/
│       ├── connect_repository.py, disconnect_repository.py, set_github_username.py
│       ├── propose_issues.py, publish_issues.py
│       ├── sync_task_issue.py, close_discarded_issue.py
│       └── propose_review.py, apply_review.py
└── adapters/
    ├── inbound/http/integrations.py     # repository, issues, github usernames
    └── outbound/
        ├── code_host/github/client.py, code_host.py      # GitHubCodeHost
        ├── code_host/fake.py                             # + new port methods
        ├── persistence/                                  # new tables, columns, repos, UoW
        └── agents/adk/prompts.py, mock/data.py           # + code_review

backend/tests/
├── unit/domain/test_integrations.py
├── unit/application/test_connect_repository.py, test_publish_issues.py,
│                     test_sync_task_issue.py, test_propose_review.py
└── integration/adapters/test_github_code_host.py, test_integrations_api.py

frontend/src/
├── domain/integrations.ts, project.ts   # + github_username, repository status
├── application/ports.ts                 # + IntegrationGateway
├── application/use-cases/useIntegrations.ts
├── adapters/http/integrationGateway.ts, adapters/fake/integrationGateway.ts
└── ui/
    ├── pages/IntegrationsPage.tsx
    └── components/integrations/RepositoryForm.tsx, MemberGithubUsers.tsx, IssueBadge.tsx
```

**Structure Decision**: web application on the existing hexagonal layout. All GitHub knowledge stays in `adapters/outbound/code_host/github/`; use cases only see the `CodeHost` port, so the demo runs on `FakeCodeHost` without a token.

## API Contract

Follows [plan/api-conventions.md](../../plan/api-conventions.md) (headers, error body, status codes). The API tests assert every status row below.

New domain errors (with T007): `RepositoryNotAccessible`, `RepositoryNotConnected`, `NothingToPublish`, `PublicationPending`, `CodeHostUnavailable`, `MemberNotFound`.

`github_action` proposals (publishing issues, requesting reviews) are approved through spec 005's proposal API; approving them runs `PublishIssues` or `ApplyReview`. The webhook (`POST /webhooks/github`) is spec 008's contract.

### Changes to other specs' shapes

- `Project` (001) adds `has_token: bool`. `github_token` is **never** returned.
- `Member` (001) adds `github_username: string | null`.
- `Task` (003) adds `issue`: `{"number": 12, "url": "https://github.com/acme/app/issues/12", "state": "open", "broken": false}` or `null`. `state`: `open` | `closed` | `merged`; `broken: true` when the issue was deleted on GitHub.
- `Proposal` (005) adds `result: object | null`: what applying produced. `create_issues` → `{"created": [{"task_id", "number"}], "failed": [{"task_id", "error"}]}`; `request_review` → `{"review_requested": true, "commented": true}` (the steps done, so a retry doesn't post twice). If some issues fail, the application fails too (`apply_failed`), so spec 005's `POST /api/proposals/{id}/apply` retries only the missing ones.
- Activity events (005) add `repository_connected`, `repository_disconnected`, `issues_published`, `issue_updated` (`broken` when deleted on GitHub), `issue_closed` and `review_requested` (FR-020).

**Connection**

```json
{
  "repository": "acme/agile-app",
  "has_token": true,
  "mode": "github",
  "webhook_registered": true,
  "replaced": "acme/old-repo"
}
```

`mode`: `github` (real calls) | `test` (no token anywhere, `FakeCodeHost`, FR-005). `replaced` is the previous repo or `null`.

### `PUT /api/projects/{id}/repository` — connect or replace the repo (US1)

Request headers: `Content-Type: application/json`

```json
{ "repository": "acme/agile-app", "token": "github_pat_…" }
```

- `repository`: `owner/name` (`^[A-Za-z0-9-]{1,39}/[A-Za-z0-9._-]{1,100}$`).
- `token`: optional and write-only. Missing → keep the current project token, or fall back to the installation token, or test mode (FR-004). `""` deletes the project token.
- Replacing deletes the old repo's webhook; existing issue links are kept.

| Status | When | Body |
|---|---|---|
| `200` | Connected (or replaced) and webhook registered | `Connection` |
| `400` | Body isn't JSON | Error `malformed_request` |
| `404` | Unknown project | Error `project_not_found` |
| `422` | `repository` doesn't match `owner/name` | Error `validation_failed` with `errors` |
| `422` | The repo doesn't exist, the token can't see it, or it lacks permission to create issues, comment or manage webhooks; nothing is saved | Error `repository_not_accessible`, plus `"reason": "not_found" \| "forbidden" \| "missing_permissions"` |
| `502` | GitHub didn't answer or failed (5xx, timeout) | Error `code_host_unavailable` |

### `DELETE /api/projects/{id}/repository` — disconnect (US1)

No body.

| Status | When | Body |
|---|---|---|
| `204` | Disconnected: webhook removed (best effort), project token deleted, issue links kept | Empty |
| `404` | Unknown project | Error `project_not_found` |
| `409` | No repo connected | Error `repository_not_connected` |

If deleting the webhook on GitHub fails, the repo is disconnected anyway and the failure is logged; the response is still `204`.

### `POST /api/projects/{id}/issues/propose` — propose publishing pending tasks (US2)

No body. Creates a `github_action` proposal (key `create_issues`) with every task that has no issue.

| Status | When | Body |
|---|---|---|
| `201` | Proposal created (or auto-approved and publishing in the background) | `{"proposal_id": 63, "task_count": 11}` + `Location: /api/proposals/63` |
| `404` | Unknown project | Error `project_not_found` |
| `409` | No repo connected | Error `repository_not_connected` |
| `409` | Every task already has an issue | Error `nothing_to_publish` |
| `409` | A `create_issues` proposal is already pending | Error `publication_pending`, plus `"proposal_id": 60` |

The result of publishing (created and failed issues) is stored on the proposal and announced with the `issues_published` event: `{"project_id", "proposal_id", "created": [{"task_id", "number"}], "failed": [{"task_id", "error"}]}`.

### `PUT /api/members/{id}/github-username` — set a member's GitHub user (US3)

Request headers: `Content-Type: application/json`

```json
{ "github_username": "anagomez" }
```

`null` removes it.

| Status | When | Body |
|---|---|---|
| `200` | Saved | `{"member": Member, "has_access": true}` — `has_access` is `false` when the user can't access the repo (saved with a warning, US3 scenario 2) and `null` when there's no repo or GitHub couldn't be checked |
| `400` | Body isn't JSON | Error `malformed_request` |
| `404` | Unknown member | Error `member_not_found` |
| `422` | Not a valid GitHub username (1–39 chars, letters, digits and single hyphens, not starting or ending with a hyphen) | Error `validation_failed` with `errors` |

GitHub being down doesn't fail this request: the username is saved and `has_access` is `null`.

### Calls to GitHub (outbound)

Not part of our API, but they define our error mapping (`client.py`, T011):

| GitHub answers | We do |
|---|---|
| `401` / `403` on connect | `422 repository_not_accessible` (`forbidden` / `missing_permissions`) |
| `404` on connect | `422 repository_not_accessible` (`not_found`) |
| `5xx`, timeout, secondary rate limit | Retry with backoff (T034); in a request → `502 code_host_unavailable`; in a background job → the proposal shows the failed items |
| `422` creating an issue (e.g. unknown assignee) | Retry once without assignees; if it still fails, the task goes to `failed` |

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: dependencies and configuration

- [x] T001 Move `httpx` from `backend/requirements-dev.txt` to `backend/requirements.txt`
- [x] T002 Add `PUBLIC_BASE_URL` to `backend/app/config.py` and `backend/.env.example` (used to build the webhook URL `{PUBLIC_BASE_URL}/webhooks/github`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: port, entities and persistence shared by every story

**⚠️ CRITICAL**: no user story work can begin until this phase is complete

- [x] T003 Extend `CodeHost` in `backend/app/application/ports/code_host.py`: `check_access(repo) -> RepoAccess`, `register_webhook(repo, url, secret) -> int`, `delete_webhook(repo, hook_id)`, `create_issue(..., assignees)`, `update_issue(repo, number, title, body, labels, assignees)`, `close_issue(repo, number, reason, comment)`, `user_has_access(repo, username)`, `get_pull_request_diff(repo, number)`, `request_review(repo, number, reviewers)`, `comment_on_pull_request(repo, number, body)`; remove `open_pull_request` (out of scope)
- [x] T004 Update `FakeCodeHost` in `backend/app/adapters/outbound/code_host/fake.py` to implement the full port and record every call
- [x] T005 Add `Member.github_username`, `Project.github_token` (excluded from every API response) and `Project.webhook_id` to `backend/app/domain/project.py`; add `OwnWrite(repository, number, action, created_at)` and `RepoAccess` to `backend/app/domain/integrations.py`
- [x] T006 Add `ExternalLinkTable`, `OwnWriteTable` and the new columns to `backend/app/adapters/outbound/persistence/tables.py`, with mappers, `SqlExternalLinkRepository` (by task, by issue number, add, save), `SqlOwnWriteRepository` (add, consume_matching) and `links` / `own_writes` on the `UnitOfWork` port, `SqlUnitOfWork` and `backend/tests/fakes.py`
- [x] T007 Add `RepositoryNotAccessible` (422) and `RepositoryNotConnected` (409) to `backend/app/domain/errors.py` and the HTTP error mapping
- [x] T008 Pick the code host per project in `dependencies.py`: `GitHubCodeHost(project.github_token or GITHUB_TOKEN)` when there's a token, `FakeCodeHost` otherwise (FR-004, FR-005)

**Checkpoint**: the port, persistence and code host selection are ready

---

## Phase 3: User Story 1 - Connect the project's repo (Priority: P1) 🎯 MVP

**Goal**: connect, replace and disconnect a single repo, with a clear error when it's missing or inaccessible

**Independent Test**: connect a test repo the token can access; the project shows it as connected. Try a repo that doesn't exist: clear message, no repo saved

### Tests for User Story 1

- [x] T009 [P] [US1] `ConnectRepository` / `DisconnectRepository` tests (no access → error and nothing saved; replace → old webhook deleted; disconnect keeps links) in `backend/tests/unit/application/test_connect_repository.py`
- [x] T010 [P] [US1] `GitHubCodeHost` tests for `check_access`, `register_webhook` and `delete_webhook` with `httpx.MockTransport` in `backend/tests/integration/adapters/test_github_code_host.py`

### Implementation for User Story 1

- [x] T011 [US1] Implement the REST client in `backend/app/adapters/outbound/code_host/github/client.py` (base URL, auth header, error mapping) and `GitHubCodeHost` in `code_host.py` with the connection methods
- [x] T012 [US1] Implement `ConnectRepository` and `DisconnectRepository` in `backend/app/application/use_cases/integrations/`
- [x] T013 [US1] Create `backend/app/adapters/inbound/http/integrations.py` with `PUT /api/projects/{id}/repository` (`{repository, token?}`) and `DELETE /api/projects/{id}/repository`; include it in `main.py`
- [ ] T014 [US1] Add `IntegrationGateway` (ports, http, fake), `useIntegrations`, `IntegrationsPage` and `RepositoryForm` (replace confirmation, write-only token field); route `/projects/:id/integrations` — handed off to spec 009 (frontend)

**Checkpoint**: a repo can be connected from the UI

---

## Phase 4: User Story 2 - Publish tasks as issues (Priority: P1)

**Goal**: propose, approve and create issues; keep them in sync with task edits; close discarded ones as "not planned"

**Independent Test**: with a 5-task board and a test repo, approve the proposal; 5 issues are created and each card shows its link

### Tests for User Story 2

- [x] T015 [P] [US2] Domain tests for `issue_body()` (description, criteria, checklist as `- [ ]` task list), `issue_labels()` (`type:*`, `priority:*`) in `backend/tests/unit/domain/test_integrations.py`
- [x] T016 [P] [US2] `ProposeIssues` / `PublishIssues` tests (only tasks without a link; removed tasks not published; partial failure keeps created links and lists failed ones; every write recorded as `OwnWrite`) in `backend/tests/unit/application/test_publish_issues.py`
- [x] T017 [P] [US2] `SyncTaskIssue` / `CloseDiscardedIssue` tests (no proposal; issue updated; closed as `not_planned` with a comment; `OwnWrite` recorded) in `backend/tests/unit/application/test_sync_task_issue.py`

### Implementation for User Story 2

- [x] T018 [US2] Implement `issue_body()` and `issue_labels()` in `backend/app/domain/integrations.py`
- [x] T019 [US2] Implement `ProposeIssues` (`github_action` proposal, key `create_issues`, content = task ids and titles) in `backend/app/application/use_cases/integrations/propose_issues.py`; trigger it when both board and repo exist for the first time (end of `ConnectRepository`, and as an `ApplyPlan` follow-up), and from `POST /api/projects/{id}/issues/propose` — `ApplyPlan` takes a list of follow-ups (project id) run after a new board is saved; `deps.get_apply_plan` registers `ProposePendingIssues` (own UnitOfWork, auto-approve in the same background job), which proposes only when a repo is connected
- [x] T020 [US2] Implement `PublishIssues(proposal_id)` in `publish_issues.py`: create each issue, save the `ExternalLink`, record an `OwnWrite`, collect failures into the proposal result; publish `IssuesPublished`
- [x] T021 [US2] Implement `SyncTaskIssue` and register it as an `after_task_changed` handler of spec 003's `UpdateTask`; implement `CloseDiscardedIssue(task_id, reason)` for spec 008's replan — `SyncTaskIssue.on_task_changed` is registered in `app.state.after_task_changed` (main.py) and runs in the background; it syncs on `task_updated` (data or checklist edits) and ignores pure moves (`task_status_changed`). `CloseDiscardedIssue` is ready for spec 008 (`deps.get_close_discarded_issue`)
- [x] T022 [US2] Add the `create_issues`, `update_issue` and `close_issue` methods to `GitHubCodeHost`
- [ ] T023 [US2] Include the issue links in spec 003's board read model and show `IssueBadge` (`#number` link, broken-link state) on `TaskCard`; add "Publish pending tasks" to `IntegrationsPage` — backend part done: every task in `GET /api/projects/{id}/board` (and in the `TaskResult` of `PATCH /api/tasks/{id}` and `PUT /api/tasks/{id}/checklist`) carries `issue: {number, url, state, broken} | null` (`TaskView`; the newest link wins). UI part (`IssueBadge`, "Publish pending tasks") handed off to spec 009 (frontend)

**Checkpoint**: User Stories 1 and 2 work independently

---

## Phase 5: User Story 3 - Register each member's GitHub username (Priority: P2)

**Goal**: enter GitHub usernames so issues are assigned and reviewers can be suggested

**Independent Test**: set a member's username, publish a task assigned to them; the issue is assigned to that user

### Tests for User Story 3

- [x] T024 [P] [US3] `SetGithubUsername` tests (saved; warning when the user has no repo access) in `backend/tests/unit/application/test_connect_repository.py`

### Implementation for User Story 3

- [x] T025 [US3] Implement `SetGithubUsername` and `PUT /api/members/{id}/github-username` (returns `{member, has_access}`)
- [ ] T026 [US3] Create `MemberGithubUsers` in `IntegrationsPage` with the access warning — handed off to spec 009 (frontend)

**Checkpoint**: User Stories 1–3 work independently

---

## Phase 6: User Story 4 - Assisted code review of a PR (Priority: P2)

**Goal**: on a PR that closes a project issue, propose reviewers and an agent review; on approval, request reviews and post the comment

**Independent Test**: open a PR with "Closes #N" in the test repo; the proposal appears; approve it and see the review request and comment on GitHub

### Tests for User Story 4

- [x] T027 [P] [US4] Domain tests for `closing_refs()` (`closes/fixes/resolves #n`, case-insensitive) and `pick_reviewers()` (right role, fewest pending reviews, never the author, fallback to another role with a reason, none when nobody has a username) in `backend/tests/unit/domain/test_integrations.py`
- [x] T028 [P] [US4] `ProposeReview` / `ApplyReview` tests (PR without project issues → nothing; proposal with reviewers + comment; approval → `request_review` + comment marked as agent-generated; `OwnWrite` recorded) in `backend/tests/unit/application/test_propose_review.py`

### Implementation for User Story 4

- [x] T029 [US4] Add `CodeReview(summary, findings: [{criterion, status, comment}], risks, reviewed_fully, rationale)` and `CODE_REVIEW_STAGE` (inputs: task, diff) to `backend/app/domain/plan.py`, with its prompt and mock output
- [x] T030 [US4] Implement `closing_refs()` and `pick_reviewers()` in `backend/app/domain/integrations.py`
- [x] T031 [US4] Implement `ProposeReview(repository, pr_number, author, body)` (fetch the diff, truncate it and set `reviewed_fully=false` when too big, run the stage, pick reviewers, create the `request_review` proposal) and `ApplyReview(proposal_id)`
- [x] T032 [US4] Add `get_pull_request_diff`, `request_review` and `comment_on_pull_request` to `GitHubCodeHost`
- [ ] T033 [US4] Call `ProposeReview` from the `pull_request.opened` branch of spec 008's webhook router — needs spec 008 (the webhook router doesn't exist yet); `ProposeReview` is ready to call through `deps.get_propose_review`

**Checkpoint**: all user stories work independently

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T034 [P] Retry with backoff on 5xx and secondary rate limits in the client; show "delayed" on the proposal while retrying — retry with backoff is done in `client.py` (5xx, 429, secondary rate limits, timeouts; tested); the "delayed" indicator on the proposal is left (no proposal state for it yet, and its UI belongs to spec 009)
- [x] T035 [P] Encrypt `github_token` at rest with a `SECRET_KEY` env var (Fernet) if time allows; otherwise document that it's stored in plain text in SQLite — done: `persistence/token_cipher.py` encrypts with Fernet when `SECRET_KEY` is set; without it tokens are stored in plain text (documented in `README.md`)
- [x] T036 Document the local webhook setup (smee.io tunnel + `PUBLIC_BASE_URL`) in `README.md` — done; adds an optional `GITHUB_WEBHOOK_URL` override because smee.io only forwards the channel URL itself, not `{PUBLIC_BASE_URL}/webhooks/github`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → **Foundational (Phase 2)** → user stories → **Polish**

### User Story Dependencies

- **US1 (P1)**: after Foundational
- **US2 (P1)**: needs a connected repo (US1) and spec 003's tasks
- **US3 (P2)**: independent from US2; improves it (assignees)
- **US4 (P2)**: needs links from US2 and usernames from US3, and the webhook router from spec 008

### Cross-spec dependencies

- **003 → 007**: tasks come from the board; `SyncTaskIssue` is an `after_task_changed` handler of `UpdateTask`; `TaskCard` shows the issue badge.
- **005 → 007 (contract)**: when a `github_action` proposal is approved, spec 005 calls `PublishIssues(proposal_id)` or `ApplyReview(proposal_id)` depending on its key.
- **007 → 008 (contract)**: spec 008 owns `POST /webhooks/github` (HMAC, delivery idempotency, event parsing) and calls `ProposeReview` on `pull_request.opened`; it consumes `OwnWrite` records to ignore the system's own changes (FR-023 ↔ 008 FR-015); it calls `CloseDiscardedIssue` and `ProposeIssues` after applying a replan.
- **001**: `Member` gains `github_username`, set only from Integrations.

### Within Each User Story

- Domain helpers before use cases
- Use cases before endpoints and `GitHubCodeHost` methods
- Endpoint before UI

## Notes

- [Story] labels map tasks to user stories for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group, and check the box here
- Avoid: vague tasks, editing the same file from two parallel tasks, cross-story dependencies that break independence
