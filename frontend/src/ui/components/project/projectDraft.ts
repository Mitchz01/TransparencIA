// What the project form holds while the leader types: numbers stay as typed text so nothing is lost,
// and they're parsed only when the form is checked or sent.

import type { Project, ProjectCreate, ProjectUpdate, RequestedMethodology } from '../../../domain/project'
import { PROJECT_DEFAULTS } from '../../../domain/rules'

export interface ProjectDraft {
  name: string
  description: string
  duration: string
  methodology: RequestedMethodology
  autoApprove: boolean
  /** Your role in a new project (spec 015); settings don't have it. */
  role: string
}

/** Whether the form asks for your role: required when your profile has none, otherwise your profile's is the default. */
export type RoleField = 'required' | 'optional'

export const emptyDraft = (profileRole: string | null = null): ProjectDraft => ({
  name: '',
  description: '',
  duration: String(PROJECT_DEFAULTS.duration_weeks),
  methodology: PROJECT_DEFAULTS.requested_methodology,
  autoApprove: PROJECT_DEFAULTS.auto_approve,
  role: profileRole ?? '',
})

export const draftFrom = (project: Project): ProjectDraft => ({
  name: project.name,
  description: project.description,
  duration: String(project.duration_weeks),
  methodology: project.requested_methodology,
  autoApprove: project.auto_approve,
  role: '',
})

/** "" or "abc" become NaN, which the rules reject with the range message. */
const toNumber = (text: string) => (text.trim() === '' ? Number.NaN : Number(text.trim()))

export function toProjectCreate(draft: ProjectDraft, roleField?: RoleField): ProjectCreate {
  const body: ProjectCreate = {
    name: draft.name,
    description: draft.description,
    duration_weeks: toNumber(draft.duration),
    requested_methodology: draft.methodology,
    auto_approve: draft.autoApprove,
  }
  // An empty optional role is left out, so the service takes the profile's.
  if (roleField === 'required' || (roleField === 'optional' && draft.role.trim())) body.role = draft.role
  return body
}

/** Only what changed, as PATCH asks. */
export function toProjectUpdate(project: Project, draft: ProjectDraft): ProjectUpdate {
  const next = toProjectCreate(draft)
  const update: ProjectUpdate = {}
  if (next.name.trim() !== project.name) update.name = next.name
  if (next.description.trim() !== project.description) update.description = next.description
  if (next.duration_weeks !== project.duration_weeks) update.duration_weeks = next.duration_weeks
  if (next.requested_methodology !== project.requested_methodology) update.requested_methodology = next.requested_methodology
  if (next.auto_approve !== project.auto_approve) update.auto_approve = next.auto_approve
  return update
}
