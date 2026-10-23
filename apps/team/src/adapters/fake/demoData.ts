// Sample data for the fake adapters: a project whose analysis, roadmap, methodology and
// architecture are approved, with the backlog proposal waiting for the leader; and a
// second project whose plan is complete and whose board is already in use.

import type { BoardView, Task } from '../../domain/board'
import type { NewEvent } from './store'
import type { StageKey } from '../../domain/plan'
import type { Account } from '../../domain/account'
import type { Member, Project } from '../../domain/project'
import type { Proposal } from '../../domain/proposals'
import { STAGE_AGENTS, STAGE_KEYS } from '../../domain/proposalContent'
import { buildBoard } from './demoBoard'
import { DEMO_RATIONALES, DEMO_STAGES } from './demoPlan'

const created = '2026-10-23T14:05:00Z'

// ---------- Accounts (spec 015): Ana leads every demo project, Leo is a member of each ----------

/** Both demo accounts sign in with this password (window.fakeBackend.signInAs switches between them). */
export const DEMO_PASSWORD = 'agile-demo'

export interface FakeAccount extends Account {
  password: string // in memory only, like everything in the fake backend
}

// The demo people's photos are Pexels portraits in public/avatars/ (free to use, no attribution required).
// Spec 020, like apps/api/app/seed.py: Ana's account is the foundation (a legal person, Ana its legal
// representative); Leo is a field technician (a natural person).
export const demoAccounts: FakeAccount[] = [
  {
    id: 1, email: 'ana@manglaresvivos.org', name: 'Fundación Manglares Vivos', role: 'Representante legal', seniority: 'senior', hours_per_week: 30,
    skills: [], github_username: null, avatar_url: '/avatars/ana-gomez.jpg', created_at: '2026-10-01T10:00:00Z', password: DEMO_PASSWORD,
    person_type: 'juridica', document_type: 'NIT', document_number: '900123456', verification_digit: '8', entity_nature: 'esal',
    legal_rep_name: 'Ana Gómez', legal_rep_document_type: 'CC', legal_rep_document_number: '52123456',
    phone: '3001234567', address: 'Calle 22 # 3-45', municipality: 'Santa Marta', department: 'Magdalena', data_consent_at: '2026-10-01T10:00:00Z',
  },
  {
    id: 2, email: 'leo@manglaresvivos.org', name: 'Leo Ruiz', role: 'Técnico de campo', seniority: 'mid', hours_per_week: 20,
    skills: [], github_username: null, avatar_url: '/avatars/leo-ruiz.jpg', created_at: '2026-10-02T10:00:00Z', password: DEMO_PASSWORD,
    person_type: 'natural', document_type: 'CC', document_number: '1082345678', verification_digit: null, entity_nature: null,
    legal_rep_name: null, legal_rep_document_type: null, legal_rep_document_number: null,
    phone: '3019876543', address: 'Corregimiento Tasajera, sector El Muelle', municipality: 'Pueblo Viejo', department: 'Magdalena', data_consent_at: '2026-10-02T10:00:00Z',
  },
]

const [ana, leo] = demoAccounts
const fromAccount = (id: number, account: FakeAccount, permission: Member['permission']): Member => ({
  id, name: account.name, role: account.role ?? '', seniority: account.seniority, hours_per_week: account.hours_per_week,
  skills: [...account.skills], avatar_url: account.avatar_url, account_id: account.id, permission,
})
/** People who never signed up (the demo board's team): members without an account. */
const guest = (member: Omit<Member, 'account_id' | 'permission'>): Member => ({ ...member, account_id: null, permission: 'member' })

export const demoPlan: NonNullable<Project['plan']> = {
  analysis: DEMO_STAGES.analysis,
  methodology: DEMO_STAGES.methodology,
  architecture: DEMO_STAGES.architecture,
  roadmap: DEMO_STAGES.roadmap,
}

export const demoProject: Project = {
  id: 1,
  name: 'Restauración de manglar, segunda fase',
  description: 'Segunda fase de la restauración de manglar en la Ciénaga Grande: ampliar a una hectárea más con la comunidad de Tasajera.',
  duration_weeks: 6,
  requested_methodology: 'scrum',
  status: 'planning',
  auto_approve: false,
  repository: null,
  plan: demoPlan,
  members: [fromAccount(11, ana, 'leader'), fromAccount(12, leo, 'member')],
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

/** Who the board's tasks were planned for; Ana and Leo joined the project too. */
const boardTeam: Member[] = [
  guest({ id: 21, name: 'Marta Díaz', role: 'Bióloga', seniority: 'senior', hours_per_week: 30, skills: [], avatar_url: '/avatars/marta-diaz.jpg' }),
  guest({ id: 22, name: 'Pablo Ortiz', role: 'Técnico de vivero', seniority: 'mid', hours_per_week: 30, skills: [], avatar_url: '/avatars/pablo-ortiz.jpg' }),
  guest({ id: 23, name: 'Sara Vidal', role: 'Promotora comunitaria', seniority: 'junior', hours_per_week: 20, skills: [], avatar_url: '/avatars/sara-vidal.jpg' }),
]

export const demoBoardProject: Project = {
  id: 2,
  name: 'Piloto de restauración de manglar',
  description: 'Piloto de restauración de una hectárea de manglar en la Ciénaga Grande de Santa Marta, con la comunidad de Tasajera. Contrato con Corpamag.',
  duration_weeks: 6,
  requested_methodology: 'scrum',
  status: 'ready',
  auto_approve: false,
  repository: null,
  plan: structuredClone(DEMO_STAGES),
  members: [fromAccount(24, ana, 'leader'), ...boardTeam, fromAccount(25, leo, 'member')],
  created_at: boardCreated,
}

export const demoBoardProposals: Proposal[] = STAGE_KEYS.map((key: StageKey, i) => ({
  id: 200 + i, project_id: 2, kind: 'plan_stage', key, agent: STAGE_AGENTS[key],
  content: DEMO_STAGES[key] as unknown as Record<string, unknown>, rationale: DEMO_RATIONALES[key], status: 'approved',
  adjusted_content: null, rejection_reason: null, auto_approved: false, origin: 'leader', apply_failed: false,
  apply_error: null, created_at: boardCreated, resolved_at: boardCreated,
}))

/** The second project's activities, two weeks in: stage 1 half done. */
export function demoBoard(nextId: () => number): BoardView {
  const board = buildBoard(demoBoardProject.id, boardTeam, DEMO_STAGES, nextId, boardCreated)
  const progress: Record<string, { status: Task['status']; checked: number }> = {
    'A-1': { status: 'done', checked: 2 },
    'A-2': { status: 'in_progress', checked: 1 },
    'A-3': { status: 'review', checked: 2 },
    'A-4': { status: 'in_progress', checked: 0 },
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
    [{ type: 'proposal_resolved', project_id: 2, actor: 'person', summary: 'Aprobaste la propuesta de etapas', ref: { kind: 'proposal', id: 205 }, proposal_id: 205, kind: 'plan_stage', key: 'sprints', status: 'approved', auto: false, reason: null }, p2(0)],
    [{ type: 'plan_applied', project_id: 2, actor: 'system', summary: 'El plan de trabajo está listo con 11 actividades', ref: { kind: 'project', id: 2 }, skipped_story_keys: [] }, p2(0)],
    [{ type: 'task_status_changed', project_id: 2, actor: 'person', summary: 'A-1 pasó a Terminada', ref: { kind: 'task', id: task('A-1') }, task_id: task('A-1'), status: 'done' }, p2(4)],
    [{ type: 'task_status_changed', project_id: 2, actor: 'person', summary: 'A-2 pasó a En ejecución', ref: { kind: 'task', id: task('A-2') }, task_id: task('A-2'), status: 'in_progress' }, p2(6)],
    [{ type: 'task_status_changed', project_id: 2, actor: 'person', summary: 'A-3 pasó a En verificación', ref: { kind: 'task', id: task('A-3') }, task_id: task('A-3'), status: 'review' }, p2(9)],
    [{ type: 'proposal_resolved', project_id: 1, actor: 'person', summary: 'Aprobaste la propuesta de cronograma', ref: { kind: 'proposal', id: 103 }, proposal_id: 103, kind: 'plan_stage', key: 'roadmap', status: 'approved', auto: false, reason: null }, p1(0)],
    [{ type: 'agent_started', project_id: 1, actor: 'agent', summary: 'El planificador de actividades está trabajando en las actividades', ref: { kind: 'project', id: 1 }, agent: 'backlog', title: 'Planificador de actividades' }, p1(1)],
    [{ type: 'proposal_created', project_id: 1, actor: 'agent', summary: 'El planificador de actividades propuso las actividades', ref: { kind: 'proposal', id: 104 }, proposal_id: 104, kind: 'plan_stage', key: 'backlog', agent: 'Product owner' }, p1(2)],
  ]
}
