// Mirrors apps/api/app/domain/plan_views.py and the API contract of spec 004.

import type { Architecture, Ceremony, Component, MethodologyDecision, StackItem } from './plan'

export type ViewStatus = 'not_generated' | 'pending' | 'approved'

export interface ViewOrigin {
  agent: string
  rationale: string
  approved_at: string
  decision: 'leader' | 'adjusted' | 'auto'
}

export interface StageView<T> {
  status: ViewStatus
  origin: ViewOrigin | null // only when approved
  content: T | null // only when approved; pending content is never sent
}

export interface Progress {
  tasks: number
  tasks_done: number
  points: number
  points_done: number
}

export interface EpicView {
  key: string
  title: string
  description: string
  progress: Progress
  has_tasks: boolean
}

export interface PhaseView {
  name: string
  goal: string
  start_week: number
  end_week: number
  deliverables: string[]
  epics: EpicView[]
  progress: Progress
}

export interface RoadmapView {
  phases: PhaseView[]
  progress: Progress
  current_week: number | null // null until the board exists
  current_phase: string | null
  overdue: boolean
}

export interface MethodologyView {
  decision: MethodologyDecision
  chosen_by: 'leader' | 'agents'
}

export interface PlanViews {
  roadmap: StageView<RoadmapView>
  methodology: StageView<MethodologyView>
  architecture: StageView<Architecture>
}

export const percentDone = (p: Progress) => (p.points === 0 ? 0 : Math.round((p.points_done / p.points) * 100))

// ---------- Drawing aids (spec 012) ----------

const CEREMONY_ORDER = [/plan/, /daily|stand|diari/, /review|demo|revisi/, /retro/]

/** Where a ceremony falls in an iteration: planning, daily, review, retro; unknown ones go last. */
export const ceremonyStep = (name: string) => {
  const step = CEREMONY_ORDER.findIndex((pattern) => pattern.test(name.toLowerCase()))
  return step === -1 ? CEREMONY_ORDER.length : step
}

/** The ceremonies in the order they happen; unknown ones keep the agent's order after the known ones. */
export const orderCeremonies = (ceremonies: Ceremony[]) =>
  ceremonies.map((c, i) => ({ c, i })).sort((a, b) => ceremonyStep(a.c.name) - ceremonyStep(b.c.name) || a.i - b.i).map(({ c }) => c)

export interface LayerGroup {
  layer: StackItem | null // null: the components that share no technology with any layer
  components: Component[]
}

const techWords = (technology: string) => new Set(technology.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3))

/** Each component inside the first stack layer that shares a technology word with it ("React + Vite" → "React + Tailwind"). */
export function groupByLayer(architecture: Architecture): LayerGroup[] {
  const groups: LayerGroup[] = architecture.stack.map((layer) => ({ layer, components: [] }))
  const rest: Component[] = []
  for (const component of architecture.components) {
    const words = techWords(component.technology)
    const group = groups.find((g) => [...techWords(g.layer!.technology)].some((w) => words.has(w)))
    if (group) group.components.push(component)
    else rest.push(component)
  }
  return rest.length ? [...groups, { layer: null, components: rest }] : groups
}
