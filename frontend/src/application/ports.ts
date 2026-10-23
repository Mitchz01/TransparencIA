// Frontend ports: the UI depends on these interfaces, not on fetch.
// adapters/http (real backend) and adapters/fake (no backend) implement them.
// Endpoints, status codes and errors: frontend/docs/api-contract.md.
// Every method rejects with an ApiError (application/errors.ts) on failure.

import type { DomainEvent } from '../domain/events'
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

/** What app/container.tsx (handed-off frontend shell) provides to the UI. */
export interface Gateways {
  projects: ProjectGateway
  proposals: ProposalGateway
  activity: ActivityGateway
  events: EventStream
  // PlanningGateway (002), BoardGateway (003), DocumentGateway (006) and IntegrationGateway (007)
  // are added by their specs.
}
