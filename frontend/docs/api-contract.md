# API contract (frontend)

Everything the frontend needs to talk to the backend: how to call it, the TypeScript shapes of every request and response, what each status code means, and how the UI should react to each error.

- **Source of truth**: [plan/api-conventions.md](../../plan/api-conventions.md) and the **API Contract** section of each spec's `plan.md`. This document gathers them for the frontend. If they ever disagree, the plan wins: fix this file in the same PR that changes the plan.
- **Where it plugs in**: `src/adapters/http/client.ts` implements the calling rules; each gateway in `src/adapters/http/` implements one group of endpoints below (and `src/adapters/fake/` the same ones in memory); `src/domain/*.ts` holds the shapes; `src/application/ports.ts` declares the gateways and `src/application/errors.ts` holds `ApiError`, so pages and hooks can catch it without importing `adapters/`.
- **Implemented so far**: `ProjectGateway` (incl. `getPlanViews`), `ProposalGateway`, `ActivityGateway` and `EventStream`, with `createHttpGateways()` and `createFakeGateways()` (seeded with a demo project) for `app/container.tsx`.

## Contents

1. [Calling the API](#1-calling-the-api)
2. [Errors](#2-errors)
3. [Shapes](#3-shapes)
4. [Endpoints by gateway](#4-endpoints-by-gateway)
5. [Live events (SSE)](#5-live-events-sse)
6. [Not defined yet](#6-not-defined-yet)

## 1. Calling the API

| Rule | Detail |
|---|---|
| Base URL | `/api`. In dev, Vite proxies `/api` to `http://localhost:8000` (`vite.config.ts`); never hardcode the host |
| Auth | None. No cookies, no tokens |
| Body | JSON, `snake_case` fields. Send `Content-Type: application/json` on every request with a body |
| Tracing | Send `X-Request-Id: <uuid>` (`crypto.randomUUID()`); the response echoes it. Show it in error toasts so a bug report can be matched to the server log |
| Dates | ISO 8601 UTC strings (`2026-10-23T14:05:00Z`); `YYYY-MM-DD` for dates. Format them in the UI, never send localized dates |
| Ids | `number` |
| `PATCH` | Send only the fields that changed. `null` clears a nullable field. Never send an empty object |
| `201` | The new resource is in the body; `Location` has its URL |
| `202` | The work continues in the background. Don't poll: the result arrives over SSE ([section 5](#5-live-events-sse)) |
| `204` | No body. Don't call `response.json()` |
| Secrets | GitHub tokens are write-only. Use `type="password"`, never prefill; the API only tells you `has_token` |

Fetch wrapper outline (`src/adapters/http/client.ts`):

```ts
export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'X-Request-Id': crypto.randomUUID() }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let res: Response
  try {
    res = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new ApiError(0, { code: 'network_error', detail: 'Can’t reach the server.' }, headers['X-Request-Id'])
  }
  const requestId = res.headers.get('X-Request-Id') ?? headers['X-Request-Id']
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, data ?? { code: 'internal_error', detail: 'Unexpected error.' }, requestId)
  return data as T
}
```

## 2. Errors

Every error has the same body, from every endpoint:

```ts
export interface FieldError {
  field: string // path into the request body: "name", "members[1].hours_per_week", "" = whole body
  message: string // safe to show
}

export interface ApiErrorBody {
  code: string // switch on this, never on detail
  detail: string // safe to show
  errors?: FieldError[] // only on 422
  [extra: string]: unknown // some codes add context (reason, proposal_id, current_version)
}

// In src/application/errors.ts (client.ts imports it).
// Explicit fields: the app's tsconfig uses erasableSyntaxOnly (no parameter properties).
export class ApiError extends Error {
  status: number // 0 = network error
  body: ApiErrorBody
  requestId: string

  constructor(status: number, body: ApiErrorBody, requestId: string) {
    super(body.detail)
    this.status = status
    this.body = body
    this.requestId = requestId
  }
  get code() {
    return this.body.code
  }
}
```

### What the UI does per status

| Status | Meaning | UI |
|---|---|---|
| `0` (`network_error`) | Server unreachable | Toast "Can't reach the server" + retry. Optimistic changes are reverted |
| `400` (`malformed_request`) | We sent something unreadable: a frontend bug | Generic error toast with the request id; log it |
| `401` | Only the GitHub webhook; the frontend never gets it | — |
| `404` (`*_not_found`) | The id doesn't exist (deleted, bad URL) | On a page load: "Not found" page with a link home. On an action: toast + refetch |
| `409` | Valid but not allowed right now | Show `detail` next to the action and refresh the state; see the table below for codes with a specific action |
| `422` (`validation_failed`) | A field breaks a rule | Map `errors[].field` to the form inputs and show each `message` under its input; `field: ""` goes at the top of the form. Keep what the user typed |
| `422` (other codes) | A rule that isn't a single field | See the table below |
| `500` (`internal_error`) | Server bug | Toast "Something went wrong" with the request id |
| `502` (`code_host_unavailable`) | GitHub is down or slow | Toast "GitHub isn't answering, try again in a minute" + retry |

Field paths match the request body, so for the project form `members[1].name` is the name input of the second member row.

### Error codes

| `code` | Status | Spec | UI action |
|---|---|---|---|
| `malformed_request` | 400 | all | Generic toast (frontend bug) |
| `validation_failed` | 422 | all | Inline field errors |
| `project_not_found`, `task_not_found`, `sprint_not_found`, `member_not_found`, `document_not_found`, `proposal_not_found`, `stage_not_found`, `version_not_found` | 404 | all | Not-found page or toast + refetch |
| `methodology_locked` | 409 | 001 | Disable the methodology select and explain that planning already started |
| `planning_already_running` | 409 | 002 | Go to the planning page; it's already in progress |
| `proposal_not_retryable` | 409 | 005 | Refetch the proposal; hide "Retry" |
| `planning_not_startable` | 409 | 002 | The plan is done: offer "Replan" (spec 008) instead |
| `stage_not_retryable` | 409 | 002 | Refetch the stepper; the stage changed state |
| `proposal_already_resolved` | 409 | 005 | Refetch the proposal; someone (or auto-approve) resolved it |
| `sprint_closed` | 409 | 003 | Revert the move; the target sprint is closed |
| `capacity_not_applicable` | 409 | 003 | Hide the capacity control (Kanban board) |
| `regeneration_in_progress` | 409 | 006 | Show "Regenerating…" and wait for the proposal event |
| `version_conflict` | 409 | 006 | "Someone saved a newer version (`current_version`)": offer to reload or copy your text |
| `invalid_diagram` | 422 | 006 | Show `errors[].message` above the Mermaid editor |
| `repository_not_accessible` | 422 | 007 | Message by `reason`: `not_found` "The repo doesn't exist", `forbidden` "The token can't see this repo", `missing_permissions` "The token needs issues, pull requests and webhooks permissions" |
| `repository_not_connected` | 409 | 007 | Link to Integrations to connect a repo |
| `nothing_to_publish` | 409 | 007 | "Every task already has an issue" (info, not an error style) |
| `publication_pending` | 409 | 007 | Link to the pending proposal (`proposal_id`) |
| `code_host_unavailable` | 502 | 007 | Retry toast |
| `plan_not_applied` | 409 | 008 | Disable "Replan" until the board exists |
| `sprint_already_closed` | 409 | 008 | Refetch the board |
| `internal_error` | 500 | all | Generic toast with the request id |

## 3. Shapes

Response shapes. Every `id` returned by the API is a `number` (never `null`). Mirror them in `src/domain/*.ts`; the fields marked *new* aren't there yet.

```ts
// ---------- Projects (spec 001) ----------
export type ProjectStatus = 'draft' | 'planning' | 'ready' | 'error'
export type RequestedMethodology = 'auto' | 'scrum' | 'kanban' | 'scrumban' | 'xp' | 'shape_up'
export type Seniority = 'junior' | 'mid' | 'senior'

export interface Member {
  id: number
  name: string
  role: string
  seniority: Seniority
  hours_per_week: number
  skills: string[]
  github_username?: string | null // new, spec 007 (not returned until 007 lands)
}

export interface Project {
  id: number
  name: string
  description: string
  duration_weeks: number
  requested_methodology: RequestedMethodology
  status: ProjectStatus
  auto_approve: boolean
  repository: string | null
  has_token?: boolean // new, spec 007 (not returned until 007 lands)
  plan: Partial<StageOutputs> | null // approved stage outputs (src/domain/plan.ts)
  members: Member[]
  created_at: string
}

export interface ProjectSummary {
  id: number
  name: string
  status: ProjectStatus
  duration_weeks: number
  member_count: number
  created_at: string
}

// ---------- Proposals (spec 002 / 005) ----------
export type ProposalKind = 'plan_stage' | 'document' | 'replan' | 'github_action'
export type ProposalStatus = 'pending' | 'approved' | 'adjusted' | 'rejected' | 'discarded'

export interface Proposal {
  id: number
  project_id: number
  kind: ProposalKind
  key: string // stage key, "epic_spec:EP-2", "create_issues", "request_review"…
  agent: string
  content: Record<string, unknown>
  rationale: string
  status: ProposalStatus
  adjusted_content: Record<string, unknown> | null
  rejection_reason: string | null // new, spec 002
  auto_approved: boolean
  origin: 'leader' | 'automatic' // new, spec 008: automatic ones are never auto-approved
  apply_failed: boolean // new, spec 005: decided but applying failed → offer "Retry"
  apply_error: string | null // new, spec 005
  created_at: string
  resolved_at: string | null
}

// ---------- Plan views (spec 004) ----------
export type ViewStatus = 'not_generated' | 'pending' | 'approved'

export interface ViewOrigin {
  agent: string
  rationale: string
  approved_at: string
  decision: 'leader' | 'adjusted' | 'auto'
}

export interface StageView<T> {
  status: ViewStatus
  origin: ViewOrigin | null // only when approved
  content: T | null // only when approved; pending content is never sent
}

export interface Progress {
  tasks: number
  tasks_done: number
  points: number
  points_done: number
}

export interface RoadmapView {
  phases: {
    name: string
    goal: string
    start_week: number
    end_week: number
    deliverables: string[]
    epics: { key: string; title: string; description: string; progress: Progress; has_tasks: boolean }[]
    progress: Progress
  }[]
  progress: Progress
  current_week: number | null // null until the board exists
  current_phase: string | null
  overdue: boolean
}

export interface PlanViews {
  roadmap: StageView<RoadmapView>
  methodology: StageView<{ decision: StageOutputs['methodology']; chosen_by: 'leader' | 'agents' }>
  architecture: StageView<StageOutputs['architecture']>
}

// ---------- Board (spec 003) ----------
export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done'
export type TaskType = 'feature' | 'bug' | 'chore' | 'spike'
export type Priority = 'low' | 'medium' | 'high'

export interface ChecklistItem {
  text: string
  done: boolean
}

export interface IssueRef {
  number: number
  url: string
  state: 'open' | 'closed' | 'merged'
  broken: boolean
}

export interface Task {
  id: number
  project_id: number
  sprint_id: number | null // null = backlog
  assignee_id: number | null
  key: string
  epic_key: string
  title: string
  description: string
  acceptance_criteria: string[]
  checklist: ChecklistItem[]
  type: TaskType
  points: number
  priority: Priority
  status: TaskStatus
  position: number
  missing_role: string | null // new, spec 003
  issue: IssueRef | null // new, spec 007
}

export interface SprintLoad {
  points: number
  capacity: number
  overloaded: boolean
}

export interface Sprint {
  id: number
  number: number
  name: string
  goal: string
  phase: string
  load: SprintLoad | null // null on a continuous (Kanban) board
  closed: boolean // new, spec 008
  end_date: string | null // new, spec 008
}

export interface Objective {
  id: number
  sprint_id: number
  title: string
  done: boolean
}

export interface BoardView {
  project_id: number
  continuous: boolean // Kanban: no sprint selector, no capacity
  wip_limits: { column: 'todo' | 'in_progress' | 'review'; limit: number }[]
  capacity_override: number | null
  sprints: Sprint[]
  objectives: Objective[]
  tasks: Task[]
}

export type BoardWarning =
  | { code: 'wip_limit_exceeded'; column: TaskStatus; limit: number; count: number }
  | { code: 'sprint_overloaded'; sprint_id: number; points: number; capacity: number }

export interface TaskResult {
  task: Task
  warnings: BoardWarning[] // never block: show them, keep the change
  suggest_advance: boolean // checklist complete while in_progress → offer "Move to review?"
}

// ---------- Documents (spec 006) ----------
export type DocumentKind = 'general_spec' | 'epic_spec' | 'flow_diagram'

export interface DocumentSummary {
  id: number
  kind: DocumentKind
  epic_key: string | null
  title: string
  version: number
  outdated: boolean
  updated_at: string
}

export interface DocumentVersion {
  version: number
  created_at: string
  source: 'agent' | 'leader'
  proposal_id: number | null
}

export interface ProjectDocument extends Omit<DocumentSummary, 'updated_at'> {
  project_id: number
  content: string // Markdown, or Mermaid source for flow_diagram
  versions: DocumentVersion[]
}

// ---------- GitHub (spec 007) ----------
export interface Connection {
  repository: string
  has_token: boolean
  mode: 'github' | 'test' // test = no token anywhere, nothing reaches GitHub
  webhook_registered: boolean
  replaced: string | null
}
```

## 4. Endpoints by gateway

Each block is one gateway in `src/application/ports.ts`. "Errors" lists the codes that endpoint can return besides `400 malformed_request`, `500 internal_error` and network errors, which any call can get.

### ProjectGateway (spec 001)

| Method | Endpoint | Request | Success | Errors |
|---|---|---|---|---|
| `create(body)` | `POST /api/projects` | `ProjectCreate` | `201` `Project` | `422 validation_failed` |
| `list()` | `GET /api/projects` | — | `200` `ProjectSummary[]` (newest first) | — |
| `get(id)` | `GET /api/projects/{id}` | — | `200` `Project` | `404 project_not_found` |
| `update(id, body)` | `PATCH /api/projects/{id}` | `ProjectUpdate` | `200` `Project` | `404 project_not_found`, `409 methodology_locked`, `422 validation_failed` |
| `getPlanViews(id)` | `GET /api/projects/{id}/plan` | — | `200` `PlanViews` | `404 project_not_found` |

```ts
export interface MemberInput {
  id?: number // PATCH only: present = edit that member, absent = new member
  name: string
  role: string
  seniority?: Seniority // default "mid"
  hours_per_week?: number // default 20
  skills?: string[] // default []
}

export interface ProjectCreate {
  name: string
  description: string
  duration_weeks?: number // default 8
  requested_methodology?: RequestedMethodology // default "auto"
  auto_approve?: boolean // default false
  members: MemberInput[]
}

// Every field optional, at least one. `members` is the WHOLE new team:
// members missing from the list are removed.
export type ProjectUpdate = Partial<Omit<ProjectCreate, 'members'>> & { members?: MemberInput[] }
```

Validation (`422`, `errors[].field` → message). Mirror these rules in the form so most errors never reach the server:

| Field | Rule |
|---|---|
| `name` | Required, max 120 chars |
| `description` | Required, max 5000 chars |
| `duration_weeks` | Integer 1–52 |
| `requested_methodology` | One of the enum |
| `members` | At least 1 |
| `members[i].name` | Required, unique in the team (case-insensitive) |
| `members[i].role` | Required, max 60 chars |
| `members[i].seniority` | `junior` \| `mid` \| `senior` |
| `members[i].hours_per_week` | Integer 1–60 |
| `members[i].skills[j]` | Max 40 chars |
| `members[i].id` | Must be a member of this project (PATCH) |

`requested_methodology` can only change while `status === 'draft'`; disable the select otherwise.

`getPlanViews` (spec 004) feeds the roadmap, methodology and architecture screens in one request. A view that isn't `approved` shows "Not generated yet" or "Waiting for approval" (link to the proposal), never its content.

### ProposalGateway (spec 005)

| Method | Endpoint | Request | Success | Errors |
|---|---|---|---|---|
| `list(projectId, status?)` | `GET /api/projects/{id}/proposals?status=pending` | — | `200` `Proposal[]` (newest first) | `404 project_not_found`, `422 validation_failed` |
| `get(id)` | `GET /api/proposals/{id}` | — | `200` `Proposal` | `404 proposal_not_found` |
| `approve(id)` | `POST /api/proposals/{id}/approve` | — | `200` `Proposal` | `404 proposal_not_found`, `409 proposal_already_resolved` |
| `adjust(id, content)` | `POST /api/proposals/{id}/adjust` | `{content: object}` | `200` `Proposal` | `404 proposal_not_found`, `409 proposal_already_resolved`, `422 validation_failed` |
| `reject(id, reason)` | `POST /api/proposals/{id}/reject` | `{reason: string}` (1–1000 chars) | `200` `Proposal` | `404 proposal_not_found`, `409 proposal_already_resolved`, `422 validation_failed` |
| `retryApply(id)` | `POST /api/proposals/{id}/apply` | — | `202` `{proposal_id, status: "applying"}` | `404 proposal_not_found`, `409 proposal_not_retryable` |
| `approveMany(projectId, ids)` | `POST /api/projects/{id}/proposals/approve` | `{ids: number[]}` (1–100) | `200` `{id, ok, error: ApiErrorBody \| null}[]` | `404 project_not_found`, `422 validation_failed` |

- Approving returns right away; what the approval triggers (next stage, board, issues…) arrives as events. Show "Applying…" until then, and "Retry" when `apply_failed` is `true`.
- `adjust` sends the **whole** edited content, with the same schema as `content`. `422` paths start with `content.` (e.g. `content.sprint_length_weeks`), so map them to the editor fields.
- `adjust` is also allowed on the newest rejected proposal of a stage after 3 rejections (the stage shows "needs you").
- `approveMany` never fails as a whole: show each item's result.

### ActivityGateway (spec 005)

| Method | Endpoint | Request | Success | Errors |
|---|---|---|---|---|
| `list(projectId, before?, limit?)` | `GET /api/projects/{id}/activity?before={seq}&limit=50` | — | `200` `DomainEvent[]` (newest first) | `404 project_not_found`, `422 validation_failed` |

Pagination: pass the `seq` of the last item you have as `before`; an empty list means there's nothing older. `limit` is 1–200.

### PlanningGateway (spec 002, replan from spec 008)

| Method | Endpoint | Request | Success | Errors |
|---|---|---|---|---|
| `start(projectId)` | `POST /api/projects/{id}/planning` | — | `202` `{project_id, status: "planning", stage}` | `404 project_not_found`, `409 planning_already_running`, `409 planning_not_startable` |
| `retryStage(projectId, key)` | `POST /api/projects/{id}/planning/stages/{key}/retry` | — | `202` `{project_id, status: "planning", stage}` | `404 project_not_found`, `404 stage_not_found`, `409 stage_not_retryable` |
| `replan(projectId, reason)` | `POST /api/projects/{id}/replan` | `{reason: string}` (1–1000 chars) | `202` `{project_id, status: "replanning", supersedes: number \| null}` | `404 project_not_found`, `409 plan_not_applied`, `422 validation_failed` |

`start` also resumes after an error: it continues from the first stage without an approved proposal. Stage keys: `analysis`, `methodology`, `architecture`, `roadmap`, `backlog`, `sprints`.

### BoardGateway (spec 003, close sprint from spec 008)

| Method | Endpoint | Request | Success | Errors |
|---|---|---|---|---|
| `getBoard(projectId)` | `GET /api/projects/{id}/board` | — | `200` `BoardView` | `404 project_not_found` |
| `updateTask(taskId, patch)` | `PATCH /api/tasks/{id}` | `TaskPatch` | `200` `TaskResult` | `404 task_not_found`, `409 sprint_closed`, `422 validation_failed` |
| `setChecklist(taskId, items)` | `PUT /api/tasks/{id}/checklist` | `{items: ChecklistItem[]}` | `200` `TaskResult` | `404 task_not_found`, `422 validation_failed` |
| `setCapacity(projectId, points)` | `PUT /api/projects/{id}/capacity` | `{points_per_sprint: number \| null}` | `200` `{capacity_override, sprints: {id, load}[]}` | `404 project_not_found`, `409 capacity_not_applicable`, `422 validation_failed` |
| `closeSprint(sprintId)` | `POST /api/sprints/{id}/close` | — | `200` `{sprint: Sprint, pending_task_keys: string[], replan_proposed: boolean}` | `404 sprint_not_found`, `409 sprint_already_closed` |

```ts
// At least one field. Move and edit fields can be combined.
export interface TaskPatch {
  // move
  status?: TaskStatus
  position?: number // 0-based index in the target column
  sprint_id?: number | null // null = backlog; another sprint without status → lands in "todo"
  // edit
  title?: string // 1–200 chars
  description?: string
  points?: number // integer 0–100
  priority?: Priority
  assignee_id?: number | null // assigning clears missing_role
}
```

- Moves are **optimistic**: update the UI first, call `updateTask`, and revert with a toast if it throws.
- `warnings` never mean failure: keep the move and show the warning on the column or sprint.
- Checklist: max 50 items, each `text` 1–300 chars; `422` field paths look like `items[2].text`.
- Capacity: `points_per_sprint` integer 1–500, or `null` to go back to the estimate.

### DocumentGateway (spec 006)

| Method | Endpoint | Request | Success | Errors |
|---|---|---|---|---|
| `list(projectId)` | `GET /api/projects/{id}/documents` | — | `200` `DocumentSummary[]` | `404 project_not_found` |
| `get(documentId, version?)` | `GET /api/documents/{id}?version={n}` | — | `200` `ProjectDocument` | `404 document_not_found`, `404 version_not_found`, `422 validation_failed` |
| `regenerate(documentId, instructions)` | `POST /api/documents/{id}/regenerate` | `{instructions: string}` (1–2000 chars) | `202` `{document_id, status: "regenerating"}` | `404 document_not_found`, `409 regeneration_in_progress`, `422 validation_failed` |
| `save(documentId, content, baseVersion)` | `PUT /api/documents/{id}` | `{content: string, base_version: number}` | `200` `ProjectDocument` | `404 document_not_found`, `409 version_conflict` (+ `current_version`), `422 validation_failed`, `422 invalid_diagram` |

Always send the `version` you loaded as `base_version`. The regenerated text doesn't come back in the `202`: it arrives as a `document` proposal (`proposal_created` event).

### IntegrationGateway (spec 007)

| Method | Endpoint | Request | Success | Errors |
|---|---|---|---|---|
| `connect(projectId, body)` | `PUT /api/projects/{id}/repository` | `{repository: string, token?: string}` | `200` `Connection` | `404 project_not_found`, `422 validation_failed`, `422 repository_not_accessible` (+ `reason`), `502 code_host_unavailable` |
| `disconnect(projectId)` | `DELETE /api/projects/{id}/repository` | — | `204` | `404 project_not_found`, `409 repository_not_connected` |
| `proposeIssues(projectId)` | `POST /api/projects/{id}/issues/propose` | — | `201` `{proposal_id, task_count}` | `404 project_not_found`, `409 repository_not_connected`, `409 nothing_to_publish`, `409 publication_pending` (+ `proposal_id`) |
| `setGithubUsername(memberId, username)` | `PUT /api/members/{id}/github-username` | `{github_username: string \| null}` | `200` `{member: Member, has_access: boolean \| null}` | `404 member_not_found`, `422 validation_failed` |

- `repository` is `owner/name`. Validate it in the form with `/^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/`.
- `token`: omit it to keep the current one; `""` deletes it. Never send it back from state.
- Connecting a project that already has a repo replaces it: ask for confirmation first; `replaced` says which repo was replaced.
- `has_access: false` saves the username with a warning ("this user can't see the repo yet"); `null` means it couldn't be checked.
- When `mode === 'test'`, show a banner: "Test mode: nothing is sent to GitHub".

## 5. Live events (SSE)

`EventStream` (`src/adapters/http/eventStream.ts`) opens `GET /api/projects/{id}/events` with `EventSource` and stays open while a project page is mounted. The endpoint is spec 005's.

- One SSE message per domain event: `id:` is its `seq`, `event:` its `type`, `data:` the JSON below (it includes `type` too). Listen with `addEventListener(type, …)` for each type you handle.
- **Replay**: when `EventSource` reconnects it sends `Last-Event-ID` by itself, and the server sends what you missed first. For the first connection, open `/events?after={seq}` with the newest `seq` you already loaded (e.g. from the activity list) to avoid a gap.
- **`resync`**: you missed more than 200 events. Refetch everything the page shows (project, board, proposals).
- `: ping` comments arrive every 15 s; `EventSource` ignores them.
- Events tell you *what changed*; refetch the resource when you need its full data.
- `404 project_not_found` comes back as a normal JSON response before the stream starts: `EventSource` reports it as an error, so check the project exists before opening it.
- Ignore event types you don't know (new specs add more).

```ts
interface BaseEvent {
  seq: number // increasing; use the highest one you've seen as `after`
  project_id: number
  occurred_at: string
  actor: 'agent' | 'person' | 'github' | 'system'
  summary: string // one line, ready to show in the activity feed
  ref: { kind: string; id: number } | null // what the event is about, to link it
}

export type DomainEvent = BaseEvent &
  (
    // spec 002: planning
    | { type: 'agent_started'; agent: string; title: string }
    | { type: 'agent_finished'; agent: string; title: string; output: Record<string, unknown> }
    | { type: 'proposal_created'; proposal_id: number; kind: ProposalKind; key: string; agent: string }
    | { type: 'proposal_resolved'; proposal_id: number; kind: ProposalKind; key: string; status: ProposalStatus; auto: boolean; reason: string | null }
    // spec 005: proposals and stream
    | { type: 'proposal_apply_failed'; proposal_id: number; error: string }
    | { type: 'resync' }
    | { type: 'stage_needs_leader'; stage: string; rejections: number }
    | { type: 'plan_failed'; agent: string; error: string }
    | { type: 'plan_completed' }
    // spec 001: team
    | { type: 'team_changed'; joined: string[]; left: string[]; changed: { member_id: number; name: string; fields: string[] }[] }
    // spec 003: board
    | { type: 'plan_applied'; skipped_story_keys: string[] }
    | { type: 'task_status_changed'; task_id: number; status: TaskStatus }
    | { type: 'task_updated'; task_id: number }
    // spec 006: documents
    | { type: 'documents_generated'; missing: string[] }
    // spec 007: GitHub
    | { type: 'issues_published'; proposal_id: number; created: { task_id: number; number: number }[]; failed: { task_id: number; error: string }[] }
    // spec 008: sync and replanning
    | { type: 'objective_closed'; objective_id: number }
    | { type: 'sprint_closed'; sprint_id: number; pending_task_keys: string[] }
    | { type: 'replan_applied'; applied: string[]; discarded: { task_key: string; reason: string }[] }
    | { type: 'github_event_ignored'; reason: string }
  )
```

What to refetch per event:

| Event | Refetch |
|---|---|
| `agent_started`, `agent_finished`, `stage_needs_leader`, `plan_failed`, `plan_completed` | Planning stepper state |
| `proposal_created`, `proposal_resolved`, `proposal_apply_failed` | That proposal / the pending proposals list |
| `resync` | Everything the page shows |
| Any event | Prepend it to the activity feed (it already has `summary`, `actor` and `ref`) |
| `team_changed` | Project |
| `plan_applied`, `task_status_changed`, `task_updated`, `objective_closed`, `sprint_closed`, `replan_applied` | Board |
| `documents_generated` | Documents list |
| `issues_published` | Board (issue badges) and the proposal |

## 6. Not defined yet

- Exact payloads of `team_changed`, `plan_applied` and `documents_generated` are owned by specs 001, 003 and 006; the shapes above follow their plans and may get extra fields.
- What happens after rejecting a `document` proposal isn't named in spec 006's plan yet (spec 005, Risks).
