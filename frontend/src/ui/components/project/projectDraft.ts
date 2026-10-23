// What the project form holds while the leader types: numbers stay as typed text so nothing is lost,
// and they're parsed only when the form is checked or sent.

import type { MemberInput, Project, ProjectCreate, RequestedMethodology, Seniority } from '../../../domain/project'
import { MEMBER_DEFAULTS, PROJECT_DEFAULTS } from '../../../domain/rules'

export interface MemberDraft {
  key: string // stable row key, so removing a row keeps the others' focus and text
  id?: number
  name: string
  role: string
  seniority: Seniority
  hours: string
  skills: string[]
}

export interface ProjectDraft {
  name: string
  description: string
  duration: string
  methodology: RequestedMethodology
  autoApprove: boolean
  members: MemberDraft[]
}

let rowCount = 0
export const newMember = (): MemberDraft => ({
  key: `member-${++rowCount}`,
  name: '',
  role: '',
  seniority: MEMBER_DEFAULTS.seniority,
  hours: String(MEMBER_DEFAULTS.hours_per_week),
  skills: [],
})

export const emptyDraft = (): ProjectDraft => ({
  name: '',
  description: '',
  duration: String(PROJECT_DEFAULTS.duration_weeks),
  methodology: PROJECT_DEFAULTS.requested_methodology,
  autoApprove: PROJECT_DEFAULTS.auto_approve,
  members: [newMember(), newMember()],
})

export const draftFrom = (project: Project): ProjectDraft => ({
  name: project.name,
  description: project.description,
  duration: String(project.duration_weeks),
  methodology: project.requested_methodology,
  autoApprove: project.auto_approve,
  members: project.members.map((m) => ({ ...newMember(), id: m.id, name: m.name, role: m.role, seniority: m.seniority, hours: String(m.hours_per_week), skills: m.skills })),
})

/** "" or "abc" become NaN, which the rules reject with the range message. */
const toNumber = (text: string) => (text.trim() === '' ? Number.NaN : Number(text.trim()))

export const memberInputs = (members: MemberDraft[]): MemberInput[] =>
  members.map((m) => ({
    ...(m.id !== undefined && { id: m.id }),
    name: m.name,
    role: m.role,
    seniority: m.seniority,
    hours_per_week: toNumber(m.hours),
    skills: m.skills,
  }))

export const toProjectCreate = (draft: ProjectDraft): ProjectCreate => ({
  name: draft.name,
  description: draft.description,
  duration_weeks: toNumber(draft.duration),
  requested_methodology: draft.methodology,
  auto_approve: draft.autoApprove,
  members: memberInputs(draft.members),
})
