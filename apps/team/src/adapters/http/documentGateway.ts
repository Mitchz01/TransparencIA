import type { DocumentGateway } from '../../application/ports'
import type { DocumentSummary, ProjectDocument } from '../../domain/documents'
import { http } from './client'

export const httpDocumentGateway: DocumentGateway = {
  list: (projectId) => http.get<DocumentSummary[]>(`/projects/${projectId}/documents`),
  get: (documentId, version) => http.get<ProjectDocument>(`/documents/${documentId}`, { version }),
  regenerate: (documentId, instructions) =>
    http.post<{ document_id: number; status: 'regenerating' }>(`/documents/${documentId}/regenerate`, { instructions }),
  save: (documentId, content, baseVersion) =>
    http.put<ProjectDocument>(`/documents/${documentId}`, { content, base_version: baseVersion }),
}
