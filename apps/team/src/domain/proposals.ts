// Mirrors apps/api/app/domain/proposals.py and the API contract of spec 005.

export type ProposalKind = 'plan_stage' | 'document' | 'replan' | 'github_action'
export type ProposalStatus = 'pending' | 'approved' | 'adjusted' | 'rejected' | 'discarded'
export type ProposalOrigin = 'leader' | 'automatic' // automatic ones are never auto-approved (spec 008)

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
  rejection_reason: string | null
  auto_approved: boolean
  origin: ProposalOrigin
  apply_failed: boolean // decided but applying failed → offer "Retry"
  apply_error: string | null
  created_at: string
  resolved_at: string | null
}

export const REASON_MAX = 1000
export const BULK_MAX = 100

/** What the next steps use: the leader's version if it was adjusted. */
export const finalContent = (p: Proposal) => (p.status === 'adjusted' && p.adjusted_content ? p.adjusted_content : p.content)

export const isDecided = (p: Proposal) => p.status === 'approved' || p.status === 'adjusted'

export const canRetryApply = (p: Proposal) => isDecided(p) && p.apply_failed
