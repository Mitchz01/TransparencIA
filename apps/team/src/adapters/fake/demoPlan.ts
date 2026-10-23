// What the fake agents propose, stage by stage. Same shapes as apps/api/app/adapters/outbound/agents/mock/data.py;
// the demo projects are described in Spanish, so the agents answer in Spanish (spec 002, FR-014).

import type { Methodology, StageKey, StageOutputs, Story } from '../../domain/plan'
import type { RequestedMethodology } from '../../domain/project'

const story = (
  key: string, epic: string, title: string, points: number, role: string,
  priority: Story['priority'] = 'medium', type: Story['type'] = 'feature',
): Story => ({
  key, epic_key: epic, title, points, role, priority, type,
  description: `Como usuario quiero ${title[0].toLowerCase()}${title.slice(1)} para avanzar con el producto.`,
  acceptance_criteria: ['Funciona en escritorio y en el celular', 'Tiene pruebas básicas'],
})

export const DEMO_STAGES: StageOutputs = {
  analysis: {
    summary: 'Plataforma web para gestionar proyectos con planificación asistida por IA.',
    goals: ['Tener un MVP para la demo', 'Validarlo con 3 equipos reales'],
    in_scope: ['Proyecto y equipo', 'Tablero kanban', 'Roadmap por fases'],
    out_of_scope: ['Facturación', 'App móvil nativa'],
    risks: [
      { description: 'Respuestas inconsistentes del modelo', impact: 'high', mitigation: 'Usar salidas estructuradas con un esquema' },
      { description: 'Poco tiempo para el frontend', impact: 'medium', mitigation: 'Usar componentes ya hechos' },
    ],
    complexity: 'medium',
    team_gaps: ['Diseño UX'],
  },
  methodology: {
    methodology: 'scrumban',
    rationale: 'Equipo chico con mucha incertidumbre: iteraciones cortas con flujo continuo y límites WIP.',
    sprint_length_weeks: 2,
    ceremonies: [
      { name: 'Daily', frequency: 'Diaria, 15 min', purpose: 'Sincronizar y destrabar' },
      { name: 'Planning', frequency: 'Cada 2 semanas', purpose: 'Elegir el trabajo de la iteración' },
      { name: 'Retro', frequency: 'Cada 2 semanas', purpose: 'Mejorar el proceso' },
    ],
    wip_limits: [
      { column: 'in_progress', limit: 3 },
      { column: 'review', limit: 2 },
    ],
    alternatives: [
      { methodology: 'scrum', why_not: 'Demasiadas ceremonias para un equipo de 3 o 4 personas.' },
      { methodology: 'kanban', why_not: 'El equipo necesita cortes de iteración para las demos.' },
    ],
  },
  architecture: {
    style: 'Monolito modular',
    summary: 'Una SPA en React que consume una API en FastAPI; los agentes corren en el backend.',
    components: [
      { name: 'App web', responsibility: 'Interfaz, tablero y roadmap', technology: 'React + Vite' },
      { name: 'API', responsibility: 'Proyectos, tareas y eventos de los agentes', technology: 'FastAPI' },
      { name: 'Agentes', responsibility: 'Generar el plan', technology: 'Gemini' },
      { name: 'Base de datos', responsibility: 'Persistencia', technology: 'SQLite' },
    ],
    stack: [
      { layer: 'Frontend', technology: 'React + Tailwind', reason: 'Rápido para iterar' },
      { layer: 'Backend', technology: 'FastAPI', reason: 'Asíncrono y tipado' },
      { layer: 'IA', technology: 'Gemini', reason: 'Salidas estructuradas nativas' },
    ],
    decisions: [{ title: 'Salidas estructuradas', decision: 'Cada agente devuelve JSON con un esquema', rationale: 'Se guarda directo como tarjetas' }],
  },
  roadmap: {
    phases: [
      {
        name: 'Bases', goal: 'Base técnica y configuración del proyecto', start_week: 1, end_week: 2,
        deliverables: ['Repo y CI', 'Proyecto y equipo'],
        epics: [
          { key: 'EP-1', title: 'Puesta en marcha', description: 'Infraestructura del proyecto' },
          { key: 'EP-2', title: 'Proyectos y equipo', description: 'Gestión de proyectos y miembros' },
        ],
      },
      {
        name: 'MVP', goal: 'Generación del plan y tablero', start_week: 3, end_week: 4,
        deliverables: ['Pipeline de agentes', 'Tablero kanban'],
        epics: [
          { key: 'EP-3', title: 'Agentes', description: 'Pipeline que genera el plan' },
          { key: 'EP-4', title: 'Tablero', description: 'Kanban con arrastrar y soltar' },
        ],
      },
      {
        name: 'Beta', goal: 'Pulido y feedback', start_week: 5, end_week: 6,
        deliverables: ['Replanificación', 'Métricas'],
        epics: [{ key: 'EP-5', title: 'Métricas', description: 'Velocidad y replanificación' }],
      },
    ],
  },
  backlog: {
    stories: [
      story('US-1', 'EP-1', 'Configurar el repo y la CI', 2, 'DevOps', 'high', 'chore'),
      story('US-2', 'EP-1', 'Definir el modelo de datos', 3, 'Backend', 'high'),
      story('US-3', 'EP-2', 'Crear un proyecto con su descripción', 3, 'Frontend', 'high'),
      story('US-4', 'EP-2', 'Cargar miembros y roles', 3, 'Frontend', 'high'),
      story('US-5', 'EP-3', 'Investigar el framework de agentes', 2, 'Backend', 'high', 'spike'),
      story('US-6', 'EP-3', 'Encadenar los agentes del plan', 8, 'Backend', 'high'),
      story('US-7', 'EP-3', 'Mostrar el avance de los agentes', 5, 'Frontend'),
      story('US-8', 'EP-4', 'Ver el tablero por columnas', 5, 'Frontend', 'high'),
      story('US-9', 'EP-4', 'Mover tarjetas arrastrando', 3, 'Frontend'),
      story('US-10', 'EP-5', 'Replanificar un sprint', 8, 'Backend', 'low'),
      story('US-11', 'EP-5', 'Gráfico de velocidad', 5, 'Frontend', 'low'),
    ],
  },
  sprints: {
    sprints: [
      { number: 1, name: 'Sprint 1', goal: 'Base lista', phase: 'Bases', story_keys: ['US-1', 'US-2', 'US-3', 'US-4'] },
      { number: 2, name: 'Sprint 2', goal: 'Plan generado por agentes', phase: 'MVP', story_keys: ['US-5', 'US-6', 'US-7', 'US-8', 'US-9'] },
      { number: 3, name: 'Sprint 3', goal: 'Beta', phase: 'Beta', story_keys: ['US-10', 'US-11'] },
    ],
    assignments: [],
  },
}

/** Why each stage looks like it does, as the agent would say it. */
export const DEMO_RATIONALES: Record<StageKey, string> = {
  analysis: 'La descripción pide un MVP que equipos reales puedan probar, así que el alcance se queda en la planificación y el tablero.',
  methodology: 'Equipo chico con mucha incertidumbre: iteraciones cortas para las demos, flujo continuo y límites WIP para el resto.',
  architecture: 'Un solo despliegue mantiene simple la demo; los puertos y adaptadores permiten cambiar los agentes o GitHub sin reescribir.',
  roadmap: 'Primero las bases para que los agentes tengan dónde escribir; después el tablero, y las métricas esperan al uso real.',
  backlog: 'Historias chicas, de una persona cada una, agrupadas por épica y con el trabajo riesgoso de los agentes en prioridad alta.',
  sprints: 'Cada sprint cierra el objetivo de una fase; el trabajo pesado de los agentes va en el sprint 2, cuando la base ya está.',
}

const NAMES: Record<Methodology, string> = { scrum: 'Scrum', kanban: 'Kanban', scrumban: 'Scrumban', xp: 'XP', shape_up: 'Shape Up' }

/** The agents respect the methodology the leader asked for (spec 002); "auto" keeps their choice. */
export function demoStage<K extends StageKey>(key: K, requested: RequestedMethodology): StageOutputs[K] {
  const output = structuredClone(DEMO_STAGES[key])
  if (key === 'methodology' && requested !== 'auto' && requested !== 'scrumban') {
    const decision = output as StageOutputs['methodology']
    decision.methodology = requested
    decision.rationale = `Pediste ${NAMES[requested]}; los agentes lo ajustaron a este equipo.`
    decision.alternatives = [{ methodology: 'scrumban', why_not: 'Elegiste otra metodología.' }]
    if (requested === 'kanban') decision.ceremonies = decision.ceremonies.filter((c) => c.name !== 'Planning')
  }
  return output
}
