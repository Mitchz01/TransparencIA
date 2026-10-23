import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hasCode } from '../../application/errors'
import type { Gateways } from '../../application/ports'
import { STAGE_KEYS } from '../../domain/proposalContent'
import { createFakeBackend, type FakeBackend } from './index'
import { FakeStore } from './store'

const DELAY = 1000

let backend: FakeBackend
let api: Gateways

async function newProject(autoApprove = false) {
  const project = await settle(
    api.projects.create({
      name: 'Shop', description: 'A small online shop.', auto_approve: autoApprove,
    }),
  )
  return project.id
}

/** Lets the fake network round trip (80 ms) and the agents' work finish. */
async function settle<T>(promise: Promise<T>): Promise<T> {
  const result = promise.then((value) => ({ value }), (error: unknown) => ({ error }))
  await vi.advanceTimersByTimeAsync(200)
  const outcome = await result
  if ('error' in outcome) throw outcome.error
  return outcome.value
}

const pendingStage = (projectId: number) =>
  [...backend.store.proposals.values()].find((p) => p.project_id === projectId && p.kind === 'plan_stage' && p.status === 'pending')

beforeEach(() => {
  vi.useFakeTimers()
  backend = createFakeBackend({ store: new FakeStore(false), stageDelayMs: DELAY })
  api = backend.gateways
})

afterEach(() => {
  backend.planning.dispose()
  vi.useRealTimers()
})

describe('fake planning engine', () => {
  it('runs the six stages in order, one proposal at a time', async () => {
    const id = await newProject()
    const accepted = await settle(api.planning.start(id))
    expect(accepted).toEqual({ project_id: id, status: 'planning', stage: 'analysis' })

    for (const key of STAGE_KEYS) {
      expect(backend.store.events.at(-1)).toMatchObject({ type: 'agent_started', agent: key })
      expect(pendingStage(id)).toBeUndefined()
      await vi.advanceTimersByTimeAsync(DELAY)
      const proposal = pendingStage(id)
      expect(proposal?.key).toBe(key)
      await settle(api.proposals.approve(proposal!.id))
    }
  })

  it('builds the board and completes the project after the sprints are approved', async () => {
    const id = await newProject()
    await settle(api.planning.start(id))
    for (let i = 0; i < STAGE_KEYS.length; i++) {
      await vi.advanceTimersByTimeAsync(DELAY)
      await settle(api.proposals.approve(pendingStage(id)!.id))
    }

    const project = await settle(api.projects.get(id))
    const board = await settle(api.board.getBoard(id))
    expect(project.status).toBe('ready')
    expect(board.tasks).toHaveLength(11)
    expect(board.sprints.map((s) => s.name)).toEqual(['Sprint 1', 'Sprint 2', 'Sprint 3'])
    expect(backend.store.events.map((e) => e.type)).toEqual(expect.arrayContaining(['plan_completed', 'plan_applied']))
    expect([...backend.store.proposals.values()].some((p) => p.kind === 'document' && p.status === 'pending')).toBe(true)
  })

  it('chains every stage with auto-approve and marks them as approved automatically', async () => {
    const id = await newProject(true)
    await settle(api.planning.start(id))
    await vi.advanceTimersByTimeAsync(DELAY * STAGE_KEYS.length)

    const stages = (await settle(api.proposals.list(id))).filter((p) => p.kind === 'plan_stage')
    expect(stages).toHaveLength(6)
    expect(stages.every((p) => p.status === 'approved' && p.auto_approved)).toBe(true)
    expect((await settle(api.projects.get(id))).status).toBe('ready')
  })

  it('publishes events with increasing seq', async () => {
    const id = await newProject(true)
    await settle(api.planning.start(id))
    await vi.advanceTimersByTimeAsync(DELAY * STAGE_KEYS.length)

    const seqs = backend.store.events.map((e) => e.seq)
    expect(seqs.length).toBeGreaterThan(20)
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b))
    expect(new Set(seqs).size).toBe(seqs.length)
  })

  it('redoes a rejected stage and asks for the leader after three rejections', async () => {
    const id = await newProject()
    await settle(api.planning.start(id))
    for (let i = 0; i < 3; i++) {
      await vi.advanceTimersByTimeAsync(DELAY)
      await settle(api.proposals.reject(pendingStage(id)!.id, 'Too vague'))
    }

    expect(backend.store.events.at(-1)).toMatchObject({ type: 'stage_needs_leader', stage: 'analysis', rejections: 3 })
    await expect(settle(api.planning.start(id))).rejects.toSatisfy((e) => hasCode(e, 'planning_already_running'))

    await settle(api.planning.retryStage(id, 'analysis'))
    await vi.advanceTimersByTimeAsync(DELAY)
    expect(pendingStage(id)?.rationale).toContain('Too vague')
  })

  it('refuses to retry a stage that is not waiting for the leader', async () => {
    const id = await newProject()
    await settle(api.planning.start(id))
    await expect(settle(api.planning.retryStage(id, 'analysis'))).rejects.toSatisfy((e) => hasCode(e, 'stage_not_retryable'))
    await expect(settle(api.planning.retryStage(id, 'nope' as never))).rejects.toSatisfy((e) => hasCode(e, 'stage_not_found'))
  })

  it('fails a stage with a reason and resumes from it', async () => {
    const id = await newProject()
    backend.planning.failNextStage(id)
    await settle(api.planning.start(id))
    await vi.advanceTimersByTimeAsync(DELAY)

    expect((await settle(api.projects.get(id))).status).toBe('error')
    expect(backend.store.events.at(-1)).toMatchObject({ type: 'plan_failed', agent: 'analysis' })
    expect(await settle(api.planning.start(id))).toMatchObject({ stage: 'analysis' })
  })
})
