// What the fake spec writer produces (spec 006): a general spec, one spec per epic and a flow diagram,
// in the language of the project, built from the approved plan.

import type { EpicSpecContent, FlowDiagramContent, GeneralSpecContent } from '../../domain/proposalContent'
import type { StageOutputs } from '../../domain/plan'
import type { Project } from '../../domain/project'

type Plan = Partial<StageOutputs>

export function generalSpec(project: Project, plan: Plan): GeneralSpecContent {
  const analysis = plan.analysis
  const phases = plan.roadmap?.phases ?? []
  const markdown = [
    `# ${project.name}`,
    project.description,
    '## Objetivos',
    ...(analysis?.goals ?? []).map((g) => `- ${g}`),
    '## Alcance',
    `Incluye: ${(analysis?.in_scope ?? []).join(', ')}.`,
    `No incluye: ${(analysis?.out_of_scope ?? []).join(', ')}.`,
    '## Fases',
    ...phases.map((p) => `- **${p.name}** (semanas ${p.start_week} a ${p.end_week}): ${p.goal}.`),
    '## Riesgos',
    ...(analysis?.risks ?? []).map((r) => `- ${r.description}. Mitigación: ${r.mitigation}.`),
  ].join('\n\n')
  return { title: 'Spec general', markdown, rationale: 'Armada con el análisis, la arquitectura, el roadmap y el backlog aprobados.' }
}

export function epicSpecs(plan: Plan): EpicSpecContent[] {
  const epics = (plan.roadmap?.phases ?? []).flatMap((p) => p.epics)
  return epics.map((epic) => {
    const stories = (plan.backlog?.stories ?? []).filter((s) => s.epic_key === epic.key)
    const markdown = [
      `# ${epic.key} ${epic.title}`,
      epic.description + '.',
      '## Historias',
      ...stories.map((s) => `### ${s.key} ${s.title}\n\n${s.description}\n\n**Criterios de aceptación**\n\n${s.acceptance_criteria.map((c) => `- ${c}`).join('\n')}`),
      '## Casos borde',
      '- Sin conexión: la acción se reintenta y no se pierde lo escrito.',
      '- Dos personas editan a la vez: gana la última versión guardada y se avisa a la otra.',
    ].join('\n\n')
    return { epic_key: epic.key, title: `${epic.key} ${epic.title}`, markdown, rationale: `Solo con la épica ${epic.key} y sus historias.` }
  })
}

export function flowDiagram(project: Project): FlowDiagramContent {
  return {
    title: 'Flujo principal',
    kind: 'flow',
    mermaid: [
      'flowchart LR',
      `  A[Crear ${project.name}] --> B[Los agentes proponen el plan]`,
      '  B --> C{¿Lo apruebas?}',
      '  C -- Sí --> D[Tablero con sprints]',
      '  C -- Ajusto --> D',
      '  C -- No --> B',
      '  D --> E[El equipo mueve las tareas]',
    ].join('\n'),
  }
}
