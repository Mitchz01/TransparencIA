// Mirrors backend/app/domain/proposals.py

export type ProposalKind = 'plan_stage' | 'document' | 'replan' | 'github_action'
export type ProposalStatus = 'pending' | 'approved' | 'adjusted' | 'rejected'

export interface Proposal {
  id: number | null
  project_id: number
  kind: ProposalKind
  key: string
  agent: string
  content: Record<string, unknown>
  rationale: string
  status: ProposalStatus
  adjusted_content: Record<string, unknown> | null
  auto_approved: boolean
  created_at: string
  resolved_at: string | null
}
