import type { BulkApproveResult, ProposalGateway } from '../../application/ports'
import type { Proposal } from '../../domain/proposals'
import { http } from './client'

export const httpProposalGateway: ProposalGateway = {
  list: (projectId, status) => http.get<Proposal[]>(`/projects/${projectId}/proposals`, { status }),
  get: (id) => http.get<Proposal>(`/proposals/${id}`),
  approve: (id) => http.post<Proposal>(`/proposals/${id}/approve`),
  adjust: (id, content) => http.post<Proposal>(`/proposals/${id}/adjust`, { content }),
  reject: (id, reason) => http.post<Proposal>(`/proposals/${id}/reject`, { reason }),
  retryApply: (id) => http.post<{ proposal_id: number; status: 'applying' }>(`/proposals/${id}/apply`),
  approveMany: (projectId, ids) => http.post<BulkApproveResult[]>(`/projects/${projectId}/proposals/approve`, { ids }),
}
