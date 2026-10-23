// Mirrors backend/app/domain/project.py and the API contract of specs 001 and 015
// (frontend/docs/api-contract.md, "ProjectGateway").

import type { StageOutputs } from './plan'

export type ProjectStatus = 'draft' | 'planning' | 'ready' | 'error'
export type RequestedMethodology = 'auto' | 'scrum' | 'kanban' | 'scrumban' | 'xp' | 'shape_up'
export type Seniority = 'junior' | 'mid' | 'senior'
/** What a member can do in a project (spec 015): leaders do everything, members work on the board. */
export type Permission = 'leader' | 'member'

export const REQUESTED_METHODOLOGIES: readonly RequestedMethodology[] = ['auto', 'scrum', 'kanban', 'scrumban', 'xp', 'shape_up']
export const SENIORITIES: readonly Seniority[] = ['junior', 'mid', 'senior']

export interface Member {
  id: number
  name: string
  role: string
  seniority: Seniority
  hours_per_week: number
  skills: string[]
  github_username?: string | null // spec 007
  account_id: number | null // spec 015: the account this member is (null only for pre-015 data)
  permission: Permission // spec 015
}

export interface Objective {
  id: number | null
  title: string
  phase: string
  done: boolean
}

export interface Project {
  id: number
  name: string
  description: string
  duration_weeks: number
  requested_methodology: RequestedMethodology
  status: ProjectStatus
  auto_approve: boolean
  repository: string | null
  has_token?: boolean // spec 007, not returned yet
  plan: Partial<StageOutputs> | null // approved stage outputs, keyed by stage (spec 002)
  members: Member[]
  created_at: string
}

export interface ProjectSummary {
  id: number
  name: string
  status: ProjectStatus
  duration_weeks: number
  member_count: number
  created_at: string
  permission: Permission // spec 015: the caller's in this project
}

// ---------- Requests ----------

/** The creator becomes the only member, as leader, from their profile (spec 015). The team joins with the link. */
export interface ProjectCreate {
  name: string
  description: string
  duration_weeks?: number // default 8
  requested_methodology?: RequestedMethodology // default "auto"
  auto_approve?: boolean // default false
  role?: string // your role in this project; default your profile's, required when it has none
}

// Every field optional, at least one. The team isn't edited here any more (TeamGateway).
export type ProjectUpdate = Partial<Omit<ProjectCreate, 'role'>>

// ---------- Rules (FR-004), mirrored so most errors never reach the server ----------

export const LIMITS = {
  name: 120,
  description: 5000,
  role: 60,
  skill: 40,
  weeks: [1, 52],
  hours: [1, 60],
} as const

export interface FieldIssue {
  field: string // same paths as the API's 422 `errors[].field`
  message: string
}

export const clean = (value: string) => value.trim().replace(/\s+/g, ' ')

export function checkText(issues: FieldIssue[], field: string, value: string | undefined, max: number) {
  const text = clean(value ?? '')
  if (!text) issues.push({ field, message: 'Obligatorio.' })
  else if (text.length > max) issues.push({ field, message: `Máximo ${max} caracteres.` })
}

export function checkRange(issues: FieldIssue[], field: string, value: number | undefined, [low, high]: readonly [number, number]) {
  if (value === undefined) return
  if (!Number.isInteger(value) || value < low || value > high) issues.push({ field, message: `Debe estar entre ${low} y ${high}.` })
}

/** `role` is checked only when sent: the profile's role is the default (spec 015, FR-006). */
export function validateProjectCreate(body: ProjectCreate): FieldIssue[] {
  const issues: FieldIssue[] = []
  checkText(issues, 'name', body.name, LIMITS.name)
  checkText(issues, 'description', body.description, LIMITS.description)
  checkRange(issues, 'duration_weeks', body.duration_weeks, LIMITS.weeks)
  if (body.role !== undefined) checkText(issues, 'role', body.role, LIMITS.role)
  return issues
}

/** The methodology can only change while the project is a draft (spec 001, FR-009). */
export const canChangeMethodology = (project: Pick<Project, 'status'>) => project.status === 'draft'
