// Spec 017, US7: what the AI reads from a contract to start a project. Mirrors the API Contract of
// specs/017-transparency-portal/plan.md ("POST /api/contracts/read"). Any field may be null (or an empty
// list) when the contract doesn't state it; `duration_weeks` and `description` are computed by the backend.

import type { BudgetLine } from '@agile/domain'

export interface ContractMilestone {
  name: string
  date: string | null
  deliverable: string | null
}

export interface ContractReading {
  name: string | null
  purpose: string | null
  contracting_entity: string | null
  contractor: string | null
  contract_value: number | null
  start_date: string | null
  end_date: string | null
  duration_weeks: number | null
  lines: BudgetLine[]
  obligations: string[]
  milestones: ContractMilestone[]
  description: string | null
}

export const CONTRACT_LIMITS = { uploadBytes: 10 * 1024 * 1024, uploadTypes: ['application/pdf'] } as const
