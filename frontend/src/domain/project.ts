// Mirrors backend/app/domain/project.py and the API contract of spec 001
// (frontend/docs/api-contract.md, "ProjectGateway").

import type { StageOutputs } from './plan'

export type ProjectStatus = 'draft' | 'planning' | 'ready' | 'error'
export type RequestedMethodology = 'auto' | 'scrum' | 'kanban' | 'scrumban' | 'xp' | 'shape_up'
export type Seniority = 'junior' | 'mid' | 'senior'

export const REQUESTED_METHODOLOGIES: readonly RequestedMethodology[] = ['auto', 'scrum', 'kanban', 'scrumban', 'xp', 'shape_up']
export const SENIORITIES: readonly Seniority[] = ['junior', 'mid', 'senior']

export interface Member {
  id: number
  name: string
  role: string
  seniority: Seniority
  hours_per_week: number
  skills: string[]
  github_username?: string | null // spec 007, not returned yet
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
}

// ---------- Requests ----------

export interface MemberInput {
  id?: number // PATCH only: present = edit that member, absent = new member
  name: string
  role: string
  seniority?: Seniority // default "mid"
  hours_per_week?: number // default 20
  skills?: string[] // default []
}

export interface ProjectCreate {
  name: string
  description: string
  duration_weeks?: number // default 8
  requested_methodology?: RequestedMethodology // default "auto"
  auto_approve?: boolean // default false
  members: MemberInput[]
}

// Every field optional, at least one. `members` is the WHOLE new team:
// members missing from the list are removed.
export type ProjectUpdate = Partial<Omit<ProjectCreate, 'members'>> & { members?: MemberInput[] }

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

const clean = (value: string) => value.trim().replace(/\s+/g, ' ')

function checkText(issues: FieldIssue[], field: string, value: string | undefined, max: number) {
  const text = clean(value ?? '')
  if (!text) issues.push({ field, message: 'Required.' })
  else if (text.length > max) issues.push({ field, message: `Max ${max} characters.` })
}

function checkRange(issues: FieldIssue[], field: string, value: number | undefined, [low, high]: readonly [number, number]) {
  if (value === undefined) return
  if (!Number.isInteger(value) || value < low || value > high) issues.push({ field, message: `Must be between ${low} and ${high}.` })
}

export function validateMembers(members: MemberInput[]): FieldIssue[] {
  const issues: FieldIssue[] = []
  if (members.length === 0) issues.push({ field: 'members', message: 'The team needs at least one member.' })
  const seen = new Set<string>()
  members.forEach((member, i) => {
    const path = `members[${i}]`
    checkText(issues, `${path}.name`, member.name, LIMITS.name)
    const key = clean(member.name ?? '').toLowerCase()
    if (key && seen.has(key)) issues.push({ field: `${path}.name`, message: 'Duplicated name.' })
    if (key) seen.add(key)
    checkText(issues, `${path}.role`, member.role, LIMITS.role)
    checkRange(issues, `${path}.hours_per_week`, member.hours_per_week, LIMITS.hours)
    member.skills?.forEach((skill, j) => {
      if (clean(skill).length > LIMITS.skill) issues.push({ field: `${path}.skills[${j}]`, message: `Max ${LIMITS.skill} characters.` })
    })
  })
  return issues
}

export function validateProjectCreate(body: ProjectCreate): FieldIssue[] {
  const issues: FieldIssue[] = []
  checkText(issues, 'name', body.name, LIMITS.name)
  checkText(issues, 'description', body.description, LIMITS.description)
  checkRange(issues, 'duration_weeks', body.duration_weeks, LIMITS.weeks)
  return [...issues, ...validateMembers(body.members)]
}

/** The methodology can only change while the project is a draft (spec 001, FR-009). */
export const canChangeMethodology = (project: Pick<Project, 'status'>) => project.status === 'draft'
