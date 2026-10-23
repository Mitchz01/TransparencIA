// Mirrors backend/app/domain/board.py and the API contract of spec 003
// (frontend/docs/api-contract.md, "BoardGateway").

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done'
export type TaskType = 'feature' | 'bug' | 'chore' | 'spike'
export type Priority = 'low' | 'medium' | 'high'
export type WipColumn = 'todo' | 'in_progress' | 'review'

export const TASK_STATUSES: readonly TaskStatus[] = ['backlog', 'todo', 'in_progress', 'review', 'done']
export const PRIORITIES: readonly Priority[] = ['high', 'medium', 'low']

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
  missing_role: string | null // spec 003
  issue: IssueRef | null // spec 007
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
  closed: boolean // spec 008
  end_date: string | null // spec 008
}

export interface Objective {
  id: number
  sprint_id: number
  title: string
  done: boolean
}

export interface WipLimit {
  column: WipColumn
  limit: number
}

export interface BoardView {
  project_id: number
  continuous: boolean // Kanban: no sprint selector, no capacity
  wip_limits: WipLimit[]
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

// ---------- Requests ----------

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

/** POST /api/projects/{id}/tasks (spec 014): only the title is required; the task gets the next "US-N" key
 *  and goes to the end of its column. */
export interface NewTask {
  title: string // 1–200 chars
  sprint_id?: number | null // null or missing = backlog (or the whole board when continuous)
  status?: TaskStatus // missing = "todo" in a sprint or on a continuous board, "backlog" otherwise
  description?: string
  points?: number // integer 0–100, default 1
  priority?: Priority // default "medium"
  assignee_id?: number | null
  epic_key?: string // up to 20 chars
}

export interface CapacityResult {
  capacity_override: number | null
  sprints: { id: number; load: SprintLoad | null }[]
}

export interface CloseSprintResult {
  sprint: Sprint
  pending_task_keys: string[]
  replan_proposed: boolean
}

export const TASK_LIMITS = {
  title: 200,
  points: [0, 100],
  checklistItems: 50,
  checklistText: 300,
  capacity: [1, 500],
  epicKey: 20, // spec 014
} as const
