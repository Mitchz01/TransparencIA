// Sample data for the fake adapters: a project whose analysis, roadmap, methodology and
// architecture are approved, with the backlog proposal waiting for the leader; and a
// second project whose plan is complete and whose board is already in use.

import type { BoardView, Task } from '../../domain/board'
import type { NewEvent } from './store'
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

/** A short past for the activity feed of both demo projects, oldest first. */
export function demoHistory(board: BoardView): [NewEvent, string][] {
  const task = (key: string) => board.tasks.find((t) => t.key === key)!.id
  const p1 = (minutes: number) => new Date(Date.parse(created) + minutes * 60_000).toISOString()
  const p2 = (days: number) => new Date(Date.parse(boardCreated) + days * 86_400_000).toISOString()
  return [
    [{ type: 'proposal_resolved', project_id: 2, actor: 'person', summary: 'Aprobaste la propuesta de sprints', ref: { kind: 'proposal', id: 205 }, proposal_id: 205, kind: 'plan_stage', key: 'sprints', status: 'approved', auto: false, reason: null }, p2(0)],
    [{ type: 'plan_applied', project_id: 2, actor: 'system', summary: 'El tablero está listo con 11 tareas', ref: { kind: 'project', id: 2 }, skipped_story_keys: [] }, p2(0)],
    [{ type: 'task_status_changed', project_id: 2, actor: 'person', summary: 'US-1 pasó a Hecho', ref: { kind: 'task', id: task('US-1') }, task_id: task('US-1'), status: 'done' }, p2(4)],
    [{ type: 'task_status_changed', project_id: 2, actor: 'person', summary: 'US-2 pasó a En curso', ref: { kind: 'task', id: task('US-2') }, task_id: task('US-2'), status: 'in_progress' }, p2(6)],
    [{ type: 'task_status_changed', project_id: 2, actor: 'person', summary: 'US-3 pasó a En revisión', ref: { kind: 'task', id: task('US-3') }, task_id: task('US-3'), status: 'review' }, p2(9)],
    [{ type: 'proposal_resolved', project_id: 1, actor: 'person', summary: 'Aprobaste la propuesta de roadmap', ref: { kind: 'proposal', id: 103 }, proposal_id: 103, kind: 'plan_stage', key: 'roadmap', status: 'approved', auto: false, reason: null }, p1(0)],
    [{ type: 'agent_started', project_id: 1, actor: 'agent', summary: 'El product owner está trabajando en el backlog', ref: { kind: 'project', id: 1 }, agent: 'backlog', title: 'Product owner' }, p1(1)],
    [{ type: 'proposal_created', project_id: 1, actor: 'agent', summary: 'El product owner propuso el backlog', ref: { kind: 'proposal', id: 104 }, proposal_id: 104, kind: 'plan_stage', key: 'backlog', agent: 'Product owner' }, p1(2)],
  ]
}
