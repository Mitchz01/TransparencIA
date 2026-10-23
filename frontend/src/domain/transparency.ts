// Mirrors backend/app/domain/transparency.py and the API contract of spec 017
// (specs/017-transparency-portal/plan.md, "API Contract"). Every number here is computed by the
// backend's rules; the frontend only shows them.

export type ExpenseKind = 'invoice' | 'field_photo' | 'report'
export type ExpenseStatus = 'draft' | 'confirmed'
export type AlertLevel = 'high' | 'medium' | 'low'
export type AlertSource = 'ai' | 'rule'
export type Light = 'green' | 'yellow' | 'red'

export interface BudgetLine {
  id: string // "R1", "R2"…
  name: string
  amount: number // COP, no cents
}

export interface Budget {
  contracting_entity: string
  contractor: string
  contract_value: number
  start_date: string
  end_date: string // computed: start + the project's duration
  lines: BudgetLine[]
}

export type BudgetInput = Omit<Budget, 'end_date'>

export interface Alert {
  id: number
  expense_id?: number // in the portal's `alerts`
  level: AlertLevel
  reason: string
  source: AlertSource
  answer: string | null
  answered_at: string | null
}

export interface Expense {
  id: number
  kind: ExpenseKind
  status: ExpenseStatus
  file_url: string
  mime: string
  amount: number | null // null for photos
  date: string | null
  supplier: string | null
  concept: string | null
  budget_line_id: string | null
  task_id: number | null
  task_title: string | null
  citizen_summary: string
  alerts: Alert[]
  created_at: string
}

export interface ExpenseConfirmation {
  kind: ExpenseKind
  amount: number | null
  date: string | null
  supplier: string | null
  concept: string | null
  budget_line_id: string | null
  task_id: number | null
  citizen_summary: string
}

export interface LineStatus {
  id: string
  name: string
  amount: number
  spent: number
  available: number // negative when overspent
}

export interface Summary {
  spent: number
  spent_pct: number
  physical_pct: number | null // null when the project has no task points
  time_pct: number
  unallocated: number
  light: Light
  reasons: string[]
}

export interface TaskRef {
  id: number
  title: string
}

export interface WeekEntry {
  week_start: string
  tasks_done: TaskRef[]
  spent: number
  spent_pct_acc: number
  physical_pct_acc: number
}

export interface SprintProgress {
  name: string
  goal: string
  end_date: string | null
  done_points: number
  total_points: number
}

export interface PortalProject {
  name: string
  description: string
  contracting_entity: string
  contractor: string
  contract_value: number
  start_date: string
  end_date: string
}

export interface Portal {
  project: PortalProject
  summary: Summary
  lines: LineStatus[]
  timeline: WeekEntry[]
  sprints: SprintProgress[]
  expenses: Expense[] // confirmed only, newest first
  alerts: Alert[]
  public_url: string | null // relative ("/p/…") when the backend has no PUBLIC_APP_URL
}

export interface TeamPortal extends Portal {
  drafts: Expense[]
  public: boolean
}

export interface Publication {
  public: boolean
  public_url: string | null
}

export interface CitizenAnswer {
  answer: string
}

export const TRANSPARENCY_LIMITS = {
  uploadBytes: 10 * 1024 * 1024,
  uploadTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
  lineName: 120,
  citizenSummary: 200,
  answer: 500,
  question: 300,
} as const
