// Mirrors backend/app/domain/project.py

export type ProjectStatus = 'draft' | 'planning' | 'ready' | 'error'
export type RequestedMethodology = 'auto' | 'scrum' | 'kanban' | 'scrumban' | 'xp' | 'shape_up'
export type Seniority = 'junior' | 'mid' | 'senior'

export interface Member {
  id: number | null
  name: string
  role: string
  seniority: Seniority
  hours_per_week: number
  skills: string[]
}

export interface Objective {
  id: number | null
  title: string
  phase: string
  done: boolean
}

export interface Project {
  id: number | null
  name: string
  description: string
  duration_weeks: number
  requested_methodology: RequestedMethodology
  status: ProjectStatus
  auto_approve: boolean
  repository: string | null
  plan: Record<string, unknown> | null
  members: Member[]
  created_at: string
}
