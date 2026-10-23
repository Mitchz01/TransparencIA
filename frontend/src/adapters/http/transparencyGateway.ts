import type { TransparencyGateway } from '../../application/ports'
import type { Alert, Budget, Expense, Publication, TeamPortal } from '../../domain/transparency'
import { http } from './client'

// Spec 017. Owner: P4.
export const httpTransparencyGateway: TransparencyGateway = {
  getBudget: (projectId) => http.get<Budget | null>(`/projects/${projectId}/budget`),
  setBudget: (projectId, body) => http.put<Budget>(`/projects/${projectId}/budget`, body),
  uploadEvidence: (projectId, file) => http.upload<Expense>(`/projects/${projectId}/expenses`, file),
  confirmExpense: (projectId, expenseId, body) => http.post<Expense>(`/projects/${projectId}/expenses/${expenseId}/confirm`, body),
  discardExpense: (projectId, expenseId) => http.delete<void>(`/projects/${projectId}/expenses/${expenseId}`),
  getTeamPortal: (projectId) => http.get<TeamPortal>(`/projects/${projectId}/transparency`),
  setPublication: (projectId, isPublic) => http.put<Publication>(`/projects/${projectId}/publication`, { public: isPublic }),
  answerAlert: (projectId, alertId, answer) => http.post<Alert>(`/projects/${projectId}/alerts/${alertId}/answer`, { answer }),
}
