// Mirrors backend/app/domain/documents.py and the API contract of spec 006
// (frontend/docs/api-contract.md, "DocumentGateway").

export type DocumentKind = 'general_spec' | 'epic_spec' | 'flow_diagram'

export interface DocumentSummary {
  id: number
  kind: DocumentKind
  epic_key: string | null // only for epic_spec
  title: string
  version: number
  outdated: boolean
  updated_at: string
}

export interface DocumentVersion {
  version: number
  created_at: string
  source: 'agent' | 'leader'
  proposal_id: number | null
}

export interface ProjectDocument extends Omit<DocumentSummary, 'updated_at'> {
  project_id: number
  // Markdown for specs, Mermaid source for diagrams.
  content: string
  versions: DocumentVersion[]
}

export const DOCUMENT_LIMITS = {
  instructions: 2000,
  content: 100_000,
} as const
