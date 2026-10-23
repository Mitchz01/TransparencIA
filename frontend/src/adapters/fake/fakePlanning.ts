// Fake agents for the demo without a backend: each stage "works" for a moment, proposes the demo
// plan and waits for the leader, like spec 002's pipeline. Approving the sprints builds the board
// (spec 003) and proposes the general spec (spec 006).

import type { PlanningAccepted } from '../../application/ports'
import type { StageKey } from '../../domain/plan'
import type { Project } from '../../domain/project'
import { STAGE_AGENTS, STAGE_KEYS, isStageKey } from '../../domain/proposalContent'
import { REASON_MAX, finalContent, isDecided, type Proposal } from '../../domain/proposals'
import { rejectedInARow, stageProposals } from '../../domain/stepper'
import { buildBoard } from './demoBoard'
import { DEMO_RATIONALES, DEMO_STAGES, demoStage } from './demoPlan'
import { type FakeStore, fail, invalid, notFound } from './store'

export interface FakePlanningOptions {
  /** How long each fake agent "works" before proposing. */
  stageDelayMs?: number
}

export type FakePlanning = ReturnType<typeof createFakePlanning>

// The demo speaks Spanish, like its projects: the summaries are what the activity feed shows.
const THE: Record<StageKey, string> = {
  analysis: 'el análisis', methodology: 'la metodología', architecture: 'la arquitectura',
  roadmap: 'el roadmap', backlog: 'el backlog', sprints: 'los sprints',
}
const WHO: Record<StageKey, string> = {
  analysis: 'El analista de producto', methodology: 'El coach ágil', architecture: 'El arquitecto de software',
  roadmap: 'El product manager', backlog: 'El product owner', sprints: 'El scrum master',
}
const lower = (key: StageKey) => THE[key]

export function createFakePlanning(store: FakeStore, { stageDelayMs = 1200 }: FakePlanningOptions = {}) {
  const timers = new Set<ReturnType<typeof setTimeout>>()
  const running = new Map<number, StageKey>()
  const failNext = new Set<number>()

  const projectOf = (id: number) => store.projects.get(id) ?? notFound('project', id)
  const proposalsOf = (projectId: number) => [...store.proposals.values()].filter((p) => p.project_id === projectId)
  const nextStage = (projectId: number) =>
    STAGE_KEYS.find((key) => !stageProposals(proposalsOf(projectId), key).some(isDecided)) ?? null
  const hasPending = (projectId: number) => proposalsOf(projectId).some((p) => p.kind === 'plan_stage' && p.status === 'pending')
  const later = (fn: () => void) => {
    const timer = setTimeout(() => {
      timers.delete(timer)
      fn()
    }, stageDelayMs)
    timers.add(timer)
  }

  function runStage(projectId: number, key: StageKey, feedback: string | null = null) {
    running.set(projectId, key)
    store.publish({
      type: 'agent_started', project_id: projectId, actor: 'agent', ref: { kind: 'project', id: projectId },
      summary: `${WHO[key]} está trabajando en ${lower(key)}`, agent: key, title: STAGE_AGENTS[key],
    })
    later(() => finishStage(projectId, key, feedback))
  }

  function finishStage(projectId: number, key: StageKey, feedback: string | null) {
    running.delete(projectId)
    const project = store.projects.get(projectId)
    if (!project || project.status !== 'planning') return

    if (failNext.delete(projectId)) {
      store.projects.set(projectId, { ...project, status: 'error' })
      store.publish({
        type: 'plan_failed', project_id: projectId, actor: 'agent', ref: { kind: 'project', id: projectId },
        summary: `${WHO[key]} no pudo terminar ${lower(key)}`, agent: key,
        error: 'El agente tardó demasiado en responder.',
      })
      return
    }

    const content = demoStage(key, project.requested_methodology) as unknown as Record<string, unknown>
    const proposal: Proposal = {
      id: store.id(), project_id: projectId, kind: 'plan_stage', key, agent: STAGE_AGENTS[key], content,
      rationale: feedback ? `Cambiado según tu motivo ("${feedback}"). ${DEMO_RATIONALES[key]}` : DEMO_RATIONALES[key],
      status: 'pending', adjusted_content: null, rejection_reason: null, auto_approved: false, origin: 'leader',
      apply_failed: false, apply_error: null, created_at: store.now(), resolved_at: null,
    }
    store.proposals.set(proposal.id, proposal)
    store.publish({
      type: 'agent_finished', project_id: projectId, actor: 'agent', ref: { kind: 'proposal', id: proposal.id },
      summary: `${WHO[key]} terminó ${lower(key)}`, agent: key, title: STAGE_AGENTS[key], output: content,
    })
    store.publish({
      type: 'proposal_created', project_id: projectId, actor: 'agent', ref: { kind: 'proposal', id: proposal.id },
      summary: `${WHO[key]} propuso ${lower(key)}`, proposal_id: proposal.id, kind: 'plan_stage', key,
      agent: STAGE_AGENTS[key],
    })
    if (project.auto_approve) approveAutomatically(proposal)
  }

  function approveAutomatically(proposal: Proposal) {
    const approved: Proposal = { ...proposal, status: 'approved', auto_approved: true, resolved_at: store.now() }
    store.proposals.set(approved.id, approved)
    store.publish({
      type: 'proposal_resolved', project_id: approved.project_id, actor: 'system', ref: { kind: 'proposal', id: approved.id },
      summary: `Se aprobó automáticamente ${approved.kind === 'plan_stage' && isStageKey(approved.key) ? lower(approved.key) : 'la propuesta'}`,
      proposal_id: approved.id, kind: approved.kind, key: approved.key, status: 'approved', auto: true, reason: null,
    })
  }

  function onStageResolved(proposal: Proposal) {
    if (!isStageKey(proposal.key)) return
    const key = proposal.key
    const project = store.projects.get(proposal.project_id)
    if (!project) return

    if (isDecided(proposal)) {
      const plan = { ...(project.plan ?? {}), [key]: finalContent(proposal) }
      const next = nextStage(project.id)
      store.projects.set(project.id, { ...project, plan })
      if (next) runStage(project.id, next)
      else completePlan(store.projects.get(project.id)!)
    } else if (proposal.status === 'rejected') {
      if (rejectedInARow(proposalsOf(project.id), key)) {
        store.publish({
          type: 'stage_needs_leader', project_id: project.id, actor: 'system', ref: { kind: 'proposal', id: proposal.id },
          summary: `Rechazaste ${lower(key)} tres veces: te necesita`, stage: key, rejections: 3,
        })
      } else {
        runStage(project.id, key, proposal.rejection_reason)
      }
    }
  }

  function completePlan(project: Project) {
    const plan = { ...DEMO_STAGES, ...project.plan }
    const board = buildBoard(project.id, project.members, plan, () => store.id(), store.now())
    store.boards.set(project.id, board)
    store.projects.set(project.id, { ...project, status: 'ready' })
    store.publish({ type: 'plan_completed', project_id: project.id, actor: 'system', ref: { kind: 'project', id: project.id }, summary: 'El plan está completo' })
    store.publish({
      type: 'plan_applied', project_id: project.id, actor: 'system', ref: { kind: 'project', id: project.id },
      summary: `El tablero está listo con ${board.tasks.length} tareas`, skipped_story_keys: [],
    })
    proposeGeneralSpec(project.id)
  }

  function proposeGeneralSpec(projectId: number) {
    const project = projectOf(projectId)
    const proposal: Proposal = {
      id: store.id(), project_id: projectId, kind: 'document', key: 'general_spec', agent: 'Spec writer',
      content: {
        title: 'Spec general',
        markdown: `# ${project.name}\n\n${project.description}\n\n## Objetivos\n\n${DEMO_STAGES.analysis.goals.map((g) => `- ${g}`).join('\n')}\n`,
        rationale: 'Armada con el análisis, la arquitectura, el roadmap y el backlog aprobados.',
      },
      rationale: 'Armada con el análisis, la arquitectura, el roadmap y el backlog aprobados.',
      status: 'pending', adjusted_content: null, rejection_reason: null, auto_approved: false, origin: 'leader',
      apply_failed: false, apply_error: null, created_at: store.now(), resolved_at: null,
    }
    store.proposals.set(proposal.id, proposal)
    store.publish({
      type: 'proposal_created', project_id: projectId, actor: 'agent', ref: { kind: 'proposal', id: proposal.id },
      summary: 'El redactor de specs propuso la spec general', proposal_id: proposal.id, kind: 'document', key: 'general_spec', agent: 'Spec writer',
    })
    if (project.auto_approve) approveAutomatically(proposal)
  }

  function onDocumentResolved(proposal: Proposal) {
    if (!isDecided(proposal)) return
    const content = finalContent(proposal) as { title: string; markdown: string }
    const id = store.id()
    const now = store.now()
    store.documents.set(id, {
      id, project_id: proposal.project_id, kind: 'general_spec', epic_key: null, title: content.title, version: 1,
      outdated: false, updated_at: now, contents: { 1: content.markdown },
      versions: [{ version: 1, created_at: now, source: 'agent', proposal_id: proposal.id }],
    })
    store.publish({
      type: 'documents_generated', project_id: proposal.project_id, actor: 'agent', ref: { kind: 'document', id },
      summary: 'La spec general está lista', missing: [],
    })
  }

  const unsubscribe = store.subscribeAll((event) => {
    if (event.type !== 'proposal_resolved') return
    const proposal = store.proposals.get(event.proposal_id)
    if (proposal?.kind === 'plan_stage') onStageResolved(proposal)
    if (proposal?.kind === 'document') onDocumentResolved(proposal)
  })

  return {
    start(projectId: number): PlanningAccepted {
      const project = projectOf(projectId)
      if (project.status === 'ready') {
        fail(409, { code: 'planning_not_startable', detail: 'El plan ya está completo. Pide una replanificación.' })
      }
      const stage = nextStage(projectId) ?? 'sprints'
      const waiting = running.has(projectId) || hasPending(projectId) || rejectedInARow(proposalsOf(projectId), stage)
      if (project.status === 'planning' && waiting) {
        fail(409, { code: 'planning_already_running', detail: 'La planificación ya está en curso.' })
      }
      store.projects.set(projectId, { ...project, status: 'planning' })
      runStage(projectId, stage)
      return { project_id: projectId, status: 'planning', stage }
    },

    retryStage(projectId: number, key: string): PlanningAccepted {
      projectOf(projectId)
      if (!isStageKey(key)) return notFound('stage', key)
      const proposals = proposalsOf(projectId)
      if (!rejectedInARow(proposals, key) || running.has(projectId)) {
        fail(409, { code: 'stage_not_retryable', detail: 'Esta etapa no está esperando tu decisión.' })
      }
      runStage(projectId, key, stageProposals(proposals, key)[0]?.rejection_reason ?? null)
      return { project_id: projectId, status: 'planning', stage: key }
    },

    replan(projectId: number, reason: string) {
      const project = projectOf(projectId)
      const clean = reason.trim()
      if (!clean) invalid([{ field: 'reason', message: 'Obligatorio.' }])
      if (clean.length > REASON_MAX) invalid([{ field: 'reason', message: `Máximo ${REASON_MAX} caracteres.` }])
      if (project.status !== 'ready') fail(409, { code: 'plan_not_applied', detail: 'Primero tiene que existir el tablero.' })
      const pending = proposalsOf(projectId).find((p) => p.kind === 'replan' && p.status === 'pending')
      if (pending) store.proposals.set(pending.id, { ...pending, status: 'discarded', resolved_at: store.now() })
      return { project_id: projectId, status: 'replanning' as const, supersedes: pending?.id ?? null }
    },

    /** Picks up the stages that were running when the page was reloaded. */
    resume() {
      for (const project of store.projects.values()) {
        if (project.status !== 'planning' || running.has(project.id) || hasPending(project.id)) continue
        const next = nextStage(project.id)
        if (next && !rejectedInARow(proposalsOf(project.id), next)) runStage(project.id, next)
      }
    },

    /** The next stage of this project fails, to show the error path. */
    failNextStage(projectId: number) {
      failNext.add(projectId)
    },

    dispose() {
      unsubscribe()
      for (const timer of timers) clearTimeout(timer)
      timers.clear()
    },
  }
}
