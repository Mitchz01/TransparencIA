// Mirrors backend/app/domain/accounts.py and the API contract of spec 015
// (frontend/docs/api-contract.md, "AuthGateway" and "TeamGateway").

import { checkRange, checkText, clean, LIMITS, type FieldIssue, type Member, type Project, type Seniority } from './project'

export interface Account {
  id: number
  email: string
  name: string
  role: string | null // what they usually do; copied into each project they join
  seniority: Seniority
  hours_per_week: number
  skills: string[]
  github_username: string | null
  created_at: string
}

export interface SignUp {
  name: string
  email: string
  password: string
}

export interface SignIn {
  email: string
  password: string
}

// Partial; null clears role and github_username. A new name renames you in every project.
export type ProfileUpdate = Partial<Pick<Account, 'name' | 'role' | 'seniority' | 'hours_per_week' | 'skills' | 'github_username'>>

// Partial edit of one member by a leader. Only `permission` changes don't publish team_changed.
export type MemberUpdate = Partial<Pick<Member, 'name' | 'role' | 'seniority' | 'hours_per_week' | 'skills' | 'permission'>>

export interface Invitation {
  active: boolean
  token: string | null // the link is `${location.origin}/join/${token}`
}

export interface InvitationPreview {
  project_name: string
  leaders: string[] // names
  already_member: boolean // false when signed out
}

export interface JoinResult {
  project_id: number
  joined: boolean // false = already a member, nothing changed
}

// ---------- Rules (FR-001, FR-005), mirrored so most errors never reach the server ----------

export const ACCOUNT_LIMITS = { email: 254, password: [8, 128], github: 39 } as const

export const PROFILE_DEFAULTS = { seniority: 'mid' as Seniority, hours_per_week: 20 }

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const GITHUB_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9]))*$/

/** "  Ana@Team.dev " and "ana@team.dev" are the same account. */
export const normalizeEmail = (value: string) => value.trim().toLowerCase()

export function validateSignUp(body: SignUp): FieldIssue[] {
  const issues: FieldIssue[] = []
  checkText(issues, 'name', body.name, LIMITS.name)
  const email = normalizeEmail(body.email)
  if (!email) issues.push({ field: 'email', message: 'Obligatorio.' })
  else if (!EMAIL_PATTERN.test(email)) issues.push({ field: 'email', message: 'Escribe un email válido.' })
  else if (email.length > ACCOUNT_LIMITS.email) issues.push({ field: 'email', message: `Máximo ${ACCOUNT_LIMITS.email} caracteres.` })
  const [low, high] = ACCOUNT_LIMITS.password
  if (body.password.length < low) issues.push({ field: 'password', message: `Usa al menos ${low} caracteres.` })
  else if (body.password.length > high) issues.push({ field: 'password', message: `Máximo ${high} caracteres.` })
  return issues
}

export function validateSignIn(body: SignIn): FieldIssue[] {
  const issues: FieldIssue[] = []
  if (!body.email.trim()) issues.push({ field: 'email', message: 'Obligatorio.' })
  if (!body.password) issues.push({ field: 'password', message: 'Obligatorio.' })
  return issues
}

/** A leading "@" is dropped, as the service does. */
export const cleanGithubUsername = (value: string) => value.trim().replace(/^@/, '')

/** The same limits as a member in spec 001 (FR-005), for the fields being sent. */
export function validateProfile(body: ProfileUpdate): FieldIssue[] {
  const issues: FieldIssue[] = []
  if (body.name !== undefined) checkText(issues, 'name', body.name, LIMITS.name)
  if (body.role && clean(body.role).length > LIMITS.role) issues.push({ field: 'role', message: `Máximo ${LIMITS.role} caracteres.` })
  checkRange(issues, 'hours_per_week', body.hours_per_week, LIMITS.hours)
  body.skills?.forEach((skill, i) => {
    if (clean(skill).length > LIMITS.skill) issues.push({ field: `skills[${i}]`, message: `Máximo ${LIMITS.skill} caracteres.` })
  })
  if (body.github_username) {
    const username = cleanGithubUsername(body.github_username)
    if (username.length > ACCOUNT_LIMITS.github || !GITHUB_PATTERN.test(username)) {
      issues.push({ field: 'github_username', message: 'Solo letras, números y guiones sueltos, hasta 39.' })
    }
  }
  return issues
}

/** A leader's edit of one member: the same limits, and a role is never empty. */
export function validateMemberUpdate(body: MemberUpdate): FieldIssue[] {
  const issues = validateProfile({ name: body.name, hours_per_week: body.hours_per_week, skills: body.skills })
  if (body.role !== undefined) checkText(issues, 'role', body.role, LIMITS.role)
  return issues
}

// ---------- Who can do what in a project (spec 015, US5) ----------

type Me = Pick<Account, 'id'> | null | undefined

/** My member in the project, found by account. */
export const myMember = (project: Pick<Project, 'members'>, me: Me): Member | undefined =>
  me ? project.members.find((m) => m.account_id === me.id) : undefined

/** Leaders do everything; members see everything and work on the board (FR-012). */
export const canManage = (project: Pick<Project, 'members'>, me: Me) => myMember(project, me)?.permission === 'leader'

/** Removing or demoting this member would leave the project without a leader (FR-015). */
export function isLastLeader(project: Pick<Project, 'members'>, memberId: number) {
  const leaders = project.members.filter((m) => m.permission === 'leader')
  return leaders.length === 1 && leaders[0].id === memberId
}

/** "Ana Gómez", or "Ana Gómez 2", "3"… when the project already has it; case and spaces ignored (FR-011). */
export function uniqueName(name: string, taken: string[]): string {
  const used = new Set(taken.map((t) => clean(t).toLowerCase()))
  let candidate = name
  for (let n = 2; used.has(clean(candidate).toLowerCase()); n++) candidate = `${name} ${n}`
  return candidate
}

/** The invitation link the leader shares. */
export const invitationLink = (origin: string, token: string) => `${origin}/join/${token}`
