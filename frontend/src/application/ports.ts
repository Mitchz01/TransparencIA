// Frontend ports: the UI depends on these interfaces, not on fetch.
// adapters/http (real backend) and adapters/fake (no backend) implement them.
// Endpoints, status codes and errors: frontend/docs/api-contract.md.
// Every method rejects with an ApiError (application/errors.ts) on failure.

import type { BoardView, CapacityResult, ChecklistItem, CloseSprintResult, TaskPatch, TaskResult } from '../domain/board'
import type { DocumentSummary, ProjectDocument } from '../domain/documents'
import type { DomainEvent } from '../domain/events'
import type { ConnectRequest, Connection, GithubUsernameResult } from '../domain/integrations'
import type { StageKey } from '../domain/plan'
import type { PlanViews } from '../domain/planViews'
import type { Project, ProjectCreate, ProjectSummary, ProjectUpdate } from '../domain/project'
import type { Proposal, ProposalStatus } from '../domain/proposals'
import type { ApiErrorBody } from './errors'

// ---------- spec 001 (+ getPlanViews, spec 004) ----------

export interface ProjectGateway {
  /** POST /api/projects → 201. Errors: 422 validation_failed. Never starts planning. */
  create(body: ProjectCreate): Promise<Project>
  /** GET /api/projects → newest first. */
  list(): Promise<ProjectSummary[]>
  /** GET /api/projects/{id}. Errors: 404 project_not_found. */
  get(id: number): Promise<Project>
  /** PATCH /api/projects/{id}. Errors: 404 project_not_found, 409 methodology_locked, 422 validation_failed. */
  update(id: number, body: ProjectUpdate): Promise<Project>
  /** GET /api/projects/{id}/plan (spec 004). Errors: 404 project_not_found. */
  getPlanViews(id: number): Promise<PlanViews>
}

// ---------- spec 005 ----------

export interface BulkApproveResult {
  id: number
  ok: boolean
  error: ApiErrorBody | null
}

export interface ProposalGateway {
  /** GET /api/projects/{id}/proposals?status= → newest first. Errors: 404 project_not_found, 422. */
  list(projectId: number, status?: ProposalStatus): Promise<Proposal[]>
  /** GET /api/proposals/{id}. Errors: 404 proposal_not_found. */
  get(id: number): Promise<Proposal>
  /** POST /api/proposals/{id}/approve. Applying continues in the background (events). Errors: 404, 409 proposal_already_resolved. */
  approve(id: number): Promise<Proposal>
  /** POST /api/proposals/{id}/adjust with the WHOLE edited content. Errors: 404, 409, 422 (paths start with "content."). */
  adjust(id: number, content: Record<string, unknown>): Promise<Proposal>
  /** POST /api/proposals/{id}/reject, reason 1–1000 chars. Errors: 404, 409, 422. */
  reject(id: number, reason: string): Promise<Proposal>
  /** POST /api/proposals/{id}/apply → 202. Errors: 404, 409 proposal_not_retryable. */
  retryApply(id: number): Promise<{ proposal_id: number; status: 'applying' }>
  /** POST /api/projects/{id}/proposals/approve, 1–100 ids. Never fails as a whole. Errors: 404 project_not_found, 422. */
  approveMany(projectId: number, ids: number[]): Promise<BulkApproveResult[]>
}

export interface ActivityGateway {
  /** GET /api/projects/{id}/activity?before=&limit= → newest first; empty list = nothing older. limit 1–200, default 50. */
  list(projectId: number, options?: { before?: number; limit?: number }): Promise<DomainEvent[]>
}

export interface EventStreamOptions {
  /** Newest seq already loaded (e.g. from the activity list), to avoid a gap on the first connection. */
  after?: number
  /** Called on connection problems; EventSource keeps retrying by itself. */
  onError?: () => void
}

export interface EventStream {
  /** GET /api/projects/{id}/events (SSE). Calls onEvent for every event, including `resync`
   *  (refetch everything the page shows). Returns the function that closes the stream. */
  subscribe(projectId: number, onEvent: (event: DomainEvent) => void, options?: EventStreamOptions): () => void
}

// ---------- spec 002 (replan from spec 008) ----------

export interface PlanningAccepted {
  project_id: number
  status: 'planning'
  stage: StageKey
}

export interface PlanningGateway {
  /** POST /api/projects/{id}/planning → 202. Also resumes after an error. Errors: 404, 409 planning_already_running, 409 planning_not_startable. */
  start(projectId: number): Promise<PlanningAccepted>
  /** POST /api/projects/{id}/planning/stages/{key}/retry → 202. Errors: 404 project_not_found, 404 stage_not_found, 409 stage_not_retryable. */
  retryStage(projectId: number, key: StageKey): Promise<PlanningAccepted>
  /** POST /api/projects/{id}/replan, reason 1–1000 chars → 202. Errors: 404, 409 plan_not_applied, 422. */
  replan(projectId: number, reason: string): Promise<{ project_id: number; status: 'replanning'; supersedes: number | null }>
}

// ---------- spec 003 (close sprint from spec 008) ----------

export interface BoardGateway {
  /** GET /api/projects/{id}/board. Errors: 404 project_not_found. */
  getBoard(projectId: number): Promise<BoardView>
  /** PATCH /api/tasks/{id}. Warnings never block. Errors: 404 task_not_found, 409 sprint_closed, 422. */
  updateTask(taskId: number, patch: TaskPatch): Promise<TaskResult>
  /** PUT /api/tasks/{id}/checklist, max 50 items of 1–300 chars. Errors: 404 task_not_found, 422 (paths "items[2].text"). */
  setChecklist(taskId: number, items: ChecklistItem[]): Promise<TaskResult>
  /** PUT /api/projects/{id}/capacity, 1–500 or null for the estimate. Errors: 404, 409 capacity_not_applicable, 422. */
  setCapacity(projectId: number, points: number | null): Promise<CapacityResult>
  /** POST /api/sprints/{id}/close. Errors: 404 sprint_not_found, 409 sprint_already_closed. */
  closeSprint(sprintId: number): Promise<CloseSprintResult>
}

// ---------- spec 006 ----------

export interface DocumentGateway {
  /** GET /api/projects/{id}/documents. Errors: 404 project_not_found. */
  list(projectId: number): Promise<DocumentSummary[]>
  /** GET /api/documents/{id}?version=. Errors: 404 document_not_found, 404 version_not_found, 422. */
  get(documentId: number, version?: number): Promise<ProjectDocument>
  /** POST /api/documents/{id}/regenerate, instructions 1–2000 chars → 202; the text arrives as a proposal. Errors: 404, 409 regeneration_in_progress, 422. */
  regenerate(documentId: number, instructions: string): Promise<{ document_id: number; status: 'regenerating' }>
  /** PUT /api/documents/{id} with the loaded version as base. Errors: 404, 409 version_conflict (+ current_version), 422, 422 invalid_diagram. */
  save(documentId: number, content: string, baseVersion: number): Promise<ProjectDocument>
}

// ---------- spec 007 ----------

export interface IntegrationGateway {
  /** PUT /api/projects/{id}/repository. Errors: 404, 422, 422 repository_not_accessible (+ reason), 502 code_host_unavailable. */
  connect(projectId: number, body: ConnectRequest): Promise<Connection>
  /** DELETE /api/projects/{id}/repository → 204. Errors: 404, 409 repository_not_connected. */
  disconnect(projectId: number): Promise<void>
  /** POST /api/projects/{id}/issues/propose → 201. Errors: 404, 409 repository_not_connected, 409 nothing_to_publish, 409 publication_pending (+ proposal_id). */
  proposeIssues(projectId: number): Promise<{ proposal_id: number; task_count: number }>
  /** PUT /api/members/{id}/github-username. Errors: 404 member_not_found, 422. */
  setGithubUsername(memberId: number, username: string | null): Promise<GithubUsernameResult>
}

/** What app/container.tsx provides to the UI (application/gateways.tsx holds the context). */
export interface Gateways {
  projects: ProjectGateway
  proposals: ProposalGateway
  activity: ActivityGateway
  events: EventStream
  planning: PlanningGateway
  board: BoardGateway
  documents: DocumentGateway
  integrations: IntegrationGateway
}
