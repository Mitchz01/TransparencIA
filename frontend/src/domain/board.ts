// Espejo de backend/app/domain/board.py

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done'
export type TaskType = 'feature' | 'bug' | 'chore' | 'spike'
export type Priority = 'low' | 'medium' | 'high'

export interface Sprint {
  id: number | null
  project_id: number
  number: number
  name: string
  goal: string
  phase: string
}

export interface ChecklistItem {
  text: string
  done: boolean
}

export interface Task {
  id: number | null
  project_id: number
  sprint_id: number | null
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
}
