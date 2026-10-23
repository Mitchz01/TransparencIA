import type { StageKey } from '../../../domain/plan'

interface StageLabel {
  name: string // "Metodología"
  agent: string // "Coach ágil"
  the: string // "la metodología", for sentences
}

/** How the UI names each stage and its agent. The backend's agent titles stay in domain/proposalContent.ts. */
export const STAGE_LABELS: Record<StageKey, StageLabel> = {
  analysis: { name: 'Análisis', agent: 'Analista de producto', the: 'el análisis' },
  methodology: { name: 'Metodología', agent: 'Coach ágil', the: 'la metodología' },
  architecture: { name: 'Arquitectura', agent: 'Arquitecto de software', the: 'la arquitectura' },
  roadmap: { name: 'Roadmap', agent: 'Product manager', the: 'el roadmap' },
  backlog: { name: 'Backlog', agent: 'Product owner', the: 'el backlog' },
  sprints: { name: 'Sprints', agent: 'Scrum master', the: 'los sprints' },
}
