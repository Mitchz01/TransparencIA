import type { BoardGateway } from '../../application/ports'
import type { BoardView, CapacityResult, CloseSprintResult, TaskResult } from '../../domain/board'
import { http } from './client'

export const httpBoardGateway: BoardGateway = {
  getBoard: (projectId) => http.get<BoardView>(`/projects/${projectId}/board`),
  updateTask: (taskId, patch) => http.patch<TaskResult>(`/tasks/${taskId}`, patch),
  setChecklist: (taskId, items) => http.put<TaskResult>(`/tasks/${taskId}/checklist`, { items }),
  setCapacity: (projectId, points) => http.put<CapacityResult>(`/projects/${projectId}/capacity`, { points_per_sprint: points }),
  closeSprint: (sprintId) => http.post<CloseSprintResult>(`/sprints/${sprintId}/close`),
}
