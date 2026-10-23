// What the fake agents propose, stage by stage. Same shapes as apps/api/app/adapters/outbound/agents/mock/data.py;
// the demo projects are described in Spanish, so the agents answer in Spanish (spec 002, FR-014).
// Spec 019: a public project planned by stages (etapas), with activities, components and weights; nothing of
// software development. The schema keeps its names inside (sprints, stories, epics, points).

import type { StageKey, StageOutputs, Story } from '../../domain/plan'
import type { RequestedMethodology } from '../../domain/project'

const activity = (key: string, component: string, title: string, weight: number, role: string, priority: Story['priority'] = 'medium'): Story => ({
  key, epic_key: component, title, points: weight, role, priority, type: 'feature',
  description: `${title}, como lo pide el contrato con Corpamag.`,
  acceptance_criteria: ['Registro fotográfico de la actividad', 'Acta o informe firmado por el responsable'],
})

export const DEMO_STAGES: StageOutputs = {
  analysis: {
    summary: 'Piloto de restauración de una hectárea de manglar en la Ciénaga Grande de Santa Marta, con la comunidad de Tasajera.',
    goals: ['Sembrar 4.000 plántulas de mangle rojo', 'Lograr una supervivencia del 80 % a los tres meses'],
    in_scope: ['Diagnóstico del sitio', 'Vivero comunitario', 'Siembra y monitoreo'],
    out_of_scope: ['Obras de dragado', 'Compra de predios'],
    risks: [
      { description: 'Crecientes que arrastren las plántulas recién sembradas', impact: 'high', mitigation: 'Sembrar después de la temporada de lluvias y usar tutores' },
      { description: 'Baja participación de la comunidad', impact: 'medium', mitigation: 'Talleres y pago de jornales a familias de la zona' },
    ],
    complexity: 'medium',
    team_gaps: ['Profesional social con experiencia en pesca artesanal'],
  },
  methodology: {
    methodology: 'scrum',
    rationale: 'Un contrato público se sigue por etapas con entregables y fechas: cada etapa cierra con un informe de avance para la entidad.',
    sprint_length_weeks: 2,
    ceremonies: [
      { name: 'Comité de seguimiento', frequency: 'Cada 2 semanas', purpose: 'Revisar el avance con la entidad contratante' },
      { name: 'Visita de campo', frequency: 'Semanal', purpose: 'Verificar las actividades en el sitio' },
      { name: 'Informe de avance', frequency: 'Al cerrar cada etapa', purpose: 'Rendir cuentas con evidencias' },
    ],
    wip_limits: [],
    alternatives: [],
  },
  architecture: {
    style: 'Ejecución directa con la comunidad',
    summary: 'La fundación ejecuta con un equipo técnico y mano de obra local; el vivero abastece la siembra y el monitoreo mide la supervivencia.',
    components: [
      { name: 'Vivero comunitario', responsibility: 'Producir las plántulas', technology: 'Plántulas de mangle rojo' },
      { name: 'Siembra', responsibility: 'Plantar por lotes', technology: 'Mano de obra local' },
      { name: 'Monitoreo', responsibility: 'Medir supervivencia y crecimiento', technology: 'Parcelas de monitoreo' },
      { name: 'Talleres', responsibility: 'Formar y vincular a la comunidad', technology: 'Promotoras comunitarias' },
    ],
    stack: [
      { layer: 'Material vegetal', technology: 'Plántulas de mangle rojo', reason: 'Especie nativa con mejor supervivencia en la zona' },
      { layer: 'Personal', technology: 'Mano de obra local y promotoras comunitarias', reason: 'Deja capacidad instalada en Tasajera' },
      { layer: 'Seguimiento', technology: 'Parcelas de monitoreo', reason: 'Método aceptado por la autoridad ambiental' },
    ],
    decisions: [{ title: 'Siembra por lotes', decision: 'Sembrar en dos lotes de media hectárea', rationale: 'Si un lote falla, el segundo aprende de él' }],
  },
  roadmap: {
    phases: [
      {
        name: 'Diagnóstico', goal: 'Conocer el sitio y a la comunidad', start_week: 1, end_week: 2,
        deliverables: ['Informe de diagnóstico', 'Acta de socialización'],
        epics: [
          { key: 'C-1', title: 'Diagnóstico del sitio', description: 'Suelos, salinidad e hidrología' },
          { key: 'C-2', title: 'Comunidad', description: 'Socialización y vinculación de familias' },
        ],
      },
      {
        name: 'Vivero y siembra', goal: 'Producir y sembrar las plántulas', start_week: 3, end_week: 4,
        deliverables: ['Vivero en operación', 'Lote 1 sembrado'],
        epics: [
          { key: 'C-3', title: 'Vivero', description: 'Producción de 4.000 plántulas' },
          { key: 'C-4', title: 'Siembra', description: 'Siembra por lotes con tutores' },
        ],
      },
      {
        name: 'Seguimiento', goal: 'Medir y entregar', start_week: 5, end_week: 6,
        deliverables: ['Informe de supervivencia', 'Informe final'],
        epics: [{ key: 'C-5', title: 'Monitoreo', description: 'Supervivencia y crecimiento' }],
      },
    ],
  },
  backlog: {
    stories: [
      activity('A-1', 'C-1', 'Levantar la línea base del sitio', 2, 'Bióloga', 'high'),
      activity('A-2', 'C-1', 'Medir salinidad y nivel del agua', 3, 'Técnico de vivero', 'high'),
      activity('A-3', 'C-2', 'Socializar el proyecto con la comunidad', 3, 'Promotora comunitaria', 'high'),
      activity('A-4', 'C-2', 'Vincular a las familias que harán la siembra', 3, 'Promotora comunitaria', 'high'),
      activity('A-5', 'C-3', 'Cotizar y comprar las semillas', 2, 'Técnico de vivero', 'high'),
      activity('A-6', 'C-3', 'Adecuar el vivero comunitario', 8, 'Técnico de vivero', 'high'),
      activity('A-7', 'C-3', 'Llevar el registro de germinación', 5, 'Bióloga'),
      activity('A-8', 'C-4', 'Sembrar el lote 1 (media hectárea)', 5, 'Técnico de vivero', 'high'),
      activity('A-9', 'C-4', 'Instalar tutores y señalización', 3, 'Promotora comunitaria'),
      activity('A-10', 'C-5', 'Medir la supervivencia del lote 1', 8, 'Bióloga', 'low'),
      activity('A-11', 'C-5', 'Elaborar el informe final para Corpamag', 5, 'Bióloga', 'low'),
    ],
  },
  sprints: {
    sprints: [
      { number: 1, name: 'Etapa 1: Diagnóstico', goal: 'Sitio y comunidad listos', phase: 'Diagnóstico', story_keys: ['A-1', 'A-2', 'A-3', 'A-4'] },
      { number: 2, name: 'Etapa 2: Vivero y siembra', goal: 'Plántulas producidas y lote 1 sembrado', phase: 'Vivero y siembra', story_keys: ['A-5', 'A-6', 'A-7', 'A-8', 'A-9'] },
      { number: 3, name: 'Etapa 3: Seguimiento', goal: 'Supervivencia medida e informe entregado', phase: 'Seguimiento', story_keys: ['A-10', 'A-11'] },
    ],
    assignments: [],
  },
}

/** Why each stage looks like it does, as the agent would say it. */
export const DEMO_RATIONALES: Record<StageKey, string> = {
  analysis: 'El contrato es un piloto: el alcance se queda en una hectárea para medir la supervivencia antes de ampliar.',
  methodology: 'Por etapas de dos semanas, cada una con su informe de avance: así se rinde cuentas a la entidad con evidencias.',
  architecture: 'Ejecutar con la comunidad baja los costos y deja capacidad instalada; el vivero propio asegura plántulas sanas.',
  roadmap: 'Primero el diagnóstico, porque la siembra depende de la salinidad y el nivel del agua; el monitoreo cierra el contrato.',
  backlog: 'Actividades de una persona cada una, agrupadas por componente, con lo que condiciona la siembra en prioridad alta.',
  sprints: 'Cada etapa cierra una fase del cronograma; el trabajo pesado del vivero va en la etapa 2, cuando el sitio está diagnosticado.',
}

/** Spec 019: every project runs by stages, so the agents keep their plan whatever was requested. */
export function demoStage<K extends StageKey>(key: K, _requested: RequestedMethodology): StageOutputs[K] {
  return structuredClone(DEMO_STAGES[key])
}
