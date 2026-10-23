import type { StageKey } from '../../../domain/plan'

interface StageLabel {
  name: string // "Forma de trabajo"
  agent: string // "Asesor de planeación"
  the: string // "la forma de trabajo", for sentences
}

/** How the UI names each stage and its agent. The backend's agent titles stay in domain/proposalContent.ts. */
export const STAGE_LABELS: Record<StageKey, StageLabel> = {
  // Spec 019: the words of public projects, not of software development.
  analysis: { name: 'Diagnóstico', agent: 'Analista del proyecto', the: 'el diagnóstico' },
  methodology: { name: 'Forma de trabajo', agent: 'Asesor de planeación', the: 'la forma de trabajo' },
  architecture: { name: 'Componentes y recursos', agent: 'Coordinador técnico', the: 'los componentes y recursos' },
  roadmap: { name: 'Cronograma', agent: 'Coordinador del proyecto', the: 'el cronograma' },
  backlog: { name: 'Actividades', agent: 'Planificador de actividades', the: 'las actividades' },
  sprints: { name: 'Etapas', agent: 'Planificador de etapas', the: 'las etapas' },
}
