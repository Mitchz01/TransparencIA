// Mirrors backend/app/domain/integrations.py

export type ExternalKind = 'issue' | 'pull_request'
export type ExternalState = 'open' | 'closed' | 'merged'

export interface ExternalLink {
  id: number | null
  task_id: number
  kind: ExternalKind
  number: number
  url: string
  state: ExternalState
}
