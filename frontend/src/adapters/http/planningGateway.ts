import type { PlanningAccepted, PlanningGateway } from '../../application/ports'
import { http } from './client'

export const httpPlanningGateway: PlanningGateway = {
  start: (projectId) => http.post<PlanningAccepted>(`/projects/${projectId}/planning`),
  retryStage: (projectId, key) => http.post<PlanningAccepted>(`/projects/${projectId}/planning/stages/${key}/retry`),
  replan: (projectId, reason) =>
    http.post<{ project_id: number; status: 'replanning'; supersedes: number | null }>(`/projects/${projectId}/replan`, { reason }),
}
