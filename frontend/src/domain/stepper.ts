// Planning stepper state, derived on the client from the project, its proposals and its activity
// (specs/009-frontend/plan.md, API Contract, "Stepper state").

import type { DomainEvent } from './events'
import type { StageKey } from './plan'
import type { Project } from './project'
import { STAGE_AGENTS, STAGE_KEYS, STAGE_NAMES } from './proposalContent'
import { isDecided, type Proposal } from './proposals'

export type StageState = 'approved' | 'waiting' | 'needs_leader' | 'failed' | 'working' | 'not_started'

export interface StageStep {
  key: StageKey
  name: string
  agent: string
  state: StageState
  proposal: Proposal | null // the newest one for the stage
  reason: string | null // why it failed
}

export const REJECTIONS_CAP = 3

const newestFirst = (a: Proposal, b: Proposal) => b.created_at.localeCompare(a.created_at) || b.id - a.id

/** The plan stage proposals of one stage, newest first. */
export const stageProposals = (proposals: Proposal[], key: StageKey) =>
  proposals.filter((p) => p.kind === 'plan_stage' && p.key === key).sort(newestFirst)

/** Its newest proposals are rejected, three in a row, with no approval in between. */
export function rejectedInARow(proposals: Proposal[], key: StageKey): boolean {
  const newest = stageProposals(proposals, key).slice(0, REJECTIONS_CAP)
  return newest.length === REJECTIONS_CAP && newest.every((p) => p.status === 'rejected')
}

export function deriveStepper(project: Pick<Project, 'status'>, proposals: Proposal[], activity: DomainEvent[]): StageStep[] {
  const newest = (key: StageKey) => stageProposals(proposals, key)[0] ?? null
  const current = STAGE_KEYS.find((key) => {
    const p = newest(key)
    return !p || !isDecided(p)
  })
  const failure = [...activity].sort((a, b) => b.seq - a.seq).find((e) => e.type === 'plan_failed')

  return STAGE_KEYS.map((key): StageStep => {
    const proposal = newest(key)
    const step = { key, name: STAGE_NAMES[key], agent: STAGE_AGENTS[key], proposal, reason: null }
    if (proposal && isDecided(proposal)) return { ...step, state: 'approved' }
    if (proposal?.status === 'pending') return { ...step, state: 'waiting' }

    const askedForLeader = activity.some(
      (e) => e.type === 'stage_needs_leader' && e.stage === key && (!proposal || e.occurred_at >= proposal.created_at),
    )
    if (rejectedInARow(proposals, key) || askedForLeader) return { ...step, state: 'needs_leader' }

    if (key === current && project.status === 'error') {
      return { ...step, state: 'failed', reason: failure?.type === 'plan_failed' ? failure.error : null }
    }
    if (key === current && project.status === 'planning') return { ...step, state: 'working' }
    return { ...step, state: 'not_started' }
  })
}

/** The step the planning screen focuses on: the first one that isn't approved, else the last one. */
export const focusStep = (steps: StageStep[]) => steps.find((s) => s.state !== 'approved') ?? steps[steps.length - 1]

export const planComplete = (steps: StageStep[]) => steps.every((s) => s.state === 'approved')
