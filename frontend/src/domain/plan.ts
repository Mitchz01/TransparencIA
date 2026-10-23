// Espejo de backend/app/domain/plan.py

export type Level = 'low' | 'medium' | 'high'
export type Methodology = 'scrum' | 'kanban' | 'scrumban' | 'xp' | 'shape_up'

export interface Risk {
  description: string
  impact: Level
  mitigation: string
}

export interface Analysis {
  summary: string
  goals: string[]
  in_scope: string[]
  out_of_scope: string[]
  risks: Risk[]
  complexity: Level
  team_gaps: string[]
}

export interface Ceremony {
  name: string
  frequency: string
  purpose: string
}

export interface WipLimit {
  column: 'todo' | 'in_progress' | 'review'
  limit: number
}

export interface Alternative {
  methodology: string
  why_not: string
}

export interface MethodologyDecision {
  methodology: Methodology
  rationale: string
  sprint_length_weeks: number
  ceremonies: Ceremony[]
  wip_limits: WipLimit[]
  alternatives: Alternative[]
}

export interface Component {
  name: string
  responsibility: string
  technology: string
}

export interface StackItem {
  layer: string
  technology: string
  reason: string
}

export interface ArchitectureDecision {
  title: string
  decision: string
  rationale: string
}

export interface Architecture {
  style: string
  summary: string
  components: Component[]
  stack: StackItem[]
  decisions: ArchitectureDecision[]
}

export interface Epic {
  key: string
  title: string
  description: string
}

export interface Phase {
  name: string
  goal: string
  start_week: number
  end_week: number
  deliverables: string[]
  epics: Epic[]
}

export interface Roadmap {
  phases: Phase[]
}

export interface Story {
  key: string
  epic_key: string
  title: string
  description: string
  acceptance_criteria: string[]
  type: 'feature' | 'bug' | 'chore' | 'spike'
  points: number
  priority: Level
  role: string
}

export interface Backlog {
  stories: Story[]
}

export interface SprintPlan {
  number: number
  name: string
  goal: string
  phase: string
  story_keys: string[]
}

export interface Assignment {
  story_key: string
  member_name: string
}

export interface SprintPlanning {
  sprints: SprintPlan[]
  assignments: Assignment[]
}

export interface StageOutputs {
  analysis: Analysis
  methodology: MethodologyDecision
  architecture: Architecture
  roadmap: Roadmap
  backlog: Backlog
  sprints: SprintPlanning
}

export type StageKey = keyof StageOutputs
