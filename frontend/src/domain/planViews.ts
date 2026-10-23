// Mirrors backend/app/domain/plan_views.py and the API contract of spec 004.

import type { Architecture, MethodologyDecision } from './plan'

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

export interface EpicView {
  key: string
  title: string
  description: string
  progress: Progress
  has_tasks: boolean
}

export interface PhaseView {
  name: string
  goal: string
  start_week: number
  end_week: number
  deliverables: string[]
  epics: EpicView[]
  progress: Progress
}

export interface RoadmapView {
  phases: PhaseView[]
  progress: Progress
  current_week: number | null // null until the board exists
  current_phase: string | null
  overdue: boolean
}

export interface MethodologyView {
  decision: MethodologyDecision
  chosen_by: 'leader' | 'agents'
}

export interface PlanViews {
  roadmap: StageView<RoadmapView>
  methodology: StageView<MethodologyView>
  architecture: StageView<Architecture>
}

export const percentDone = (p: Progress) => (p.points === 0 ? 0 : Math.round((p.points_done / p.points) * 100))
