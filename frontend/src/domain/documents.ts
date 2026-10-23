// Espejo de backend/app/domain/documents.py

export type DocumentKind = 'general_spec' | 'use_case_spec' | 'flow_diagram'

export interface Document {
  id: number | null
  project_id: number
  kind: DocumentKind
  title: string
  // Markdown para specs, Mermaid para diagramas.
  content: string
  version: number
}
