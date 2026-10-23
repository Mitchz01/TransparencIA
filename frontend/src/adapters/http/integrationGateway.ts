import type { IntegrationGateway } from '../../application/ports'
import type { Connection, GithubUsernameResult } from '../../domain/integrations'
import { http } from './client'

export const httpIntegrationGateway: IntegrationGateway = {
  connect: (projectId, body) => http.put<Connection>(`/projects/${projectId}/repository`, body),
  disconnect: (projectId) => http.delete<void>(`/projects/${projectId}/repository`),
  proposeIssues: (projectId) => http.post<{ proposal_id: number; task_count: number }>(`/projects/${projectId}/issues/propose`),
  setGithubUsername: (memberId, username) =>
    http.put<GithubUsernameResult>(`/members/${memberId}/github-username`, { github_username: username }),
}
