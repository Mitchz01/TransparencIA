import type { TeamGateway } from '../../application/ports'
import type { Invitation, InvitationPreview, JoinResult } from '../../domain/account'
import type { Project } from '../../domain/project'
import { http } from './client'

const token = (value: string) => encodeURIComponent(value)

export const httpTeamGateway: TeamGateway = {
  updateMember: (projectId, memberId, body) => http.patch<Project>(`/projects/${projectId}/members/${memberId}`, body),
  removeMember: (projectId, memberId) => http.delete<void>(`/projects/${projectId}/members/${memberId}`),
  getInvitation: (projectId) => http.get<Invitation>(`/projects/${projectId}/invitation`),
  renewInvitation: (projectId) => http.post<Invitation>(`/projects/${projectId}/invitation`),
  disableInvitation: (projectId) => http.delete<void>(`/projects/${projectId}/invitation`),
  previewInvitation: (value) => http.get<InvitationPreview>(`/invitations/${token(value)}`),
  join: (value, body = {}) => http.post<JoinResult>(`/invitations/${token(value)}/join`, body),
}
