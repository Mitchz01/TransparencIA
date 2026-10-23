// Sample data for the fake adapters: a project whose analysis, roadmap, methodology and
// architecture are approved, with the backlog proposal waiting for the leader; and a
// second project whose plan is complete and whose board is already in use.

import type { BoardView, Task } from '../../domain/board'
import type { StageKey } from '../../domain/plan'
import type { Project } from '../../domain/project'
import type { Proposal } from '../../domain/proposals'
import { STAGE_AGENTS, STAGE_KEYS } from '../../domain/proposalContent'
import { buildBoard } from './demoBoard'
import { DEMO_RATIONALES, DEMO_STAGES } from './demoPlan'

const created = '2026-10-23T14:05:00Z'

export const demoPlan: NonNullable<Project['plan']> = {
  analysis: DEMO_STAGES.analysis,
  methodology: DEMO_STAGES.methodology,
  architecture: DEMO_STAGES.architecture,
  roadmap: DEMO_STAGES.roadmap,
}

export const demoProject: Project = {
  id: 1,
  name: 'Agile Planner (demo)',
  description: 'Herramienta tipo Jira donde agentes de IA planifican el trabajo.',
  duration_weeks: 6,
  requested_methodology: 'auto',
  status: 'planning',
  auto_approve: false,
  repository: null,
  plan: demoPlan,
  members: [
    { id: 11, name: 'Ana Gómez', role: 'Backend', seniority: 'senior', hours_per_week: 30, skills: ['python', 'fastapi'] },
    { id: 12, name: 'Leo Ruiz', role: 'Frontend', seniority: 'mid', hours_per_week: 20, skills: ['react'] },
  ],
  created_at: created,
}

const resolved = (id: number, key: string, agent: string, content: Record<string, unknown>, status: Proposal['status'] = 'approved'): Proposal => ({
  id, project_id: 1, kind: 'plan_stage', key, agent, content, rationale: DEMO_RATIONALES[key as StageKey], status,
  adjusted_content: null, rejection_reason: null, auto_approved: false, origin: 'leader', apply_failed: false,
  apply_error: null, created_at: created, resolved_at: status === 'pending' ? null : created,
})

export const demoProposals: Proposal[] = [
  resolved(100, 'analysis', 'Product analyst', demoPlan.analysis as unknown as Record<string, unknown>),
  resolved(101, 'methodology', 'Agile coach', demoPlan.methodology as unknown as Record<string, unknown>),
  resolved(102, 'architecture', 'Software architect', demoPlan.architecture as unknown as Record<string, unknown>),
  resolved(103, 'roadmap', 'Product manager', demoPlan.roadmap as unknown as Record<string, unknown>),
  { ...resolved(104, 'backlog', 'Product owner', DEMO_STAGES.backlog as unknown as Record<string, unknown>, 'pending'), rationale: DEMO_RATIONALES.backlog },
]

// ---------- A project with its plan complete and the board in use ----------

const boardCreated = '2026-10-09T09:30:00Z'

export const demoBoardProject: Project = {
  id: 2,
  name: 'Tienda online',
  description: 'Una tienda de muebles artesanales, con catálogo, carrito y pagos.',
  duration_weeks: 6,
  requested_methodology: 'auto',
  status: 'ready',
  auto_approve: false,
  repository: null,
  plan: structuredClone(DEMO_STAGES),
  members: [
    { id: 21, name: 'Marta Díaz', role: 'Backend', seniority: 'senior', hours_per_week: 30, skills: ['python', 'payments'] },
    { id: 22, name: 'Pablo Ortiz', role: 'Frontend', seniority: 'mid', hours_per_week: 30, skills: ['react', 'css'] },
    { id: 23, name: 'Sara Vidal', role: 'Frontend', seniority: 'junior', hours_per_week: 20, skills: ['react'] },
  ],
  created_at: boardCreated,
}

export const demoBoardProposals: Proposal[] = STAGE_KEYS.map((key: StageKey, i) => ({
  id: 200 + i, project_id: 2, kind: 'plan_stage', key, agent: STAGE_AGENTS[key],
  content: DEMO_STAGES[key] as unknown as Record<string, unknown>, rationale: DEMO_RATIONALES[key], status: 'approved',
  adjusted_content: null, rejection_reason: null, auto_approved: false, origin: 'leader', apply_failed: false,
  apply_error: null, created_at: boardCreated, resolved_at: boardCreated,
}))

/** The second project's board, two weeks in: sprint 1 half done. */
export function demoBoard(nextId: () => number): BoardView {
  const board = buildBoard(demoBoardProject.id, demoBoardProject.members, DEMO_STAGES, nextId, boardCreated)
  const progress: Record<string, { status: Task['status']; checked: number }> = {
    'US-1': { status: 'done', checked: 2 },
    'US-2': { status: 'in_progress', checked: 1 },
    'US-3': { status: 'review', checked: 2 },
    'US-4': { status: 'in_progress', checked: 0 },
  }
  for (const task of board.tasks) {
    const change = progress[task.key]
    if (!change) continue
    task.status = change.status
    task.checklist = task.checklist.map((item, i) => ({ ...item, done: i < change.checked }))
  }
  const sprintOne = board.sprints[0].id
  for (const status of ['todo', 'in_progress', 'review', 'done'] as const) {
    board.tasks.filter((t) => t.sprint_id === sprintOne && t.status === status).forEach((t, i) => (t.position = i))
  }
  return board
}
