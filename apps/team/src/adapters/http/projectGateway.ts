import type { ProjectGateway } from '../../application/ports'
import type { PlanViews } from '../../domain/planViews'
import type { Project, ProjectSummary } from '../../domain/project'
import { http } from './client'

export const httpProjectGateway: ProjectGateway = {
  create: (body) => http.post<Project>('/projects', body),
  list: () => http.get<ProjectSummary[]>('/projects'),
  get: (id) => http.get<Project>(`/projects/${id}`),
  update: (id, body) => http.patch<Project>(`/projects/${id}`, body),
  getPlanViews: (id) => http.get<PlanViews>(`/projects/${id}/plan`),
}
