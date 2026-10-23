import { describe, expect, it } from 'vitest'
import type { DomainEvent } from './events'
import type { StageKey } from './plan'
import type { Proposal } from './proposals'
import { deriveStepper, focusStep, planComplete } from './stepper'

let id = 0
const proposal = (key: StageKey, status: Proposal['status'], minute = id): Proposal => ({
  id: ++id, project_id: 1, kind: 'plan_stage', key, agent: 'Agent', content: {}, rationale: '', status,
  adjusted_content: null, rejection_reason: status === 'rejected' ? 'No' : null, auto_approved: false, origin: 'leader',
  apply_failed: false, apply_error: null, created_at: `2026-10-23T10:${String(minute).padStart(2, '0')}:00Z`, resolved_at: null,
})

const event = (seq: number, minute: number, body: Partial<DomainEvent> & Pick<DomainEvent, 'type'>): DomainEvent =>
  ({ seq, project_id: 1, occurred_at: `2026-10-23T10:${String(minute).padStart(2, '0')}:30Z`, actor: 'system', summary: '', ref: null, ...body }) as DomainEvent

const states = (steps: ReturnType<typeof deriveStepper>) => Object.fromEntries(steps.map((s) => [s.key, s.state]))

describe('deriveStepper', () => {
  it('lists the six stages in order with their agents', () => {
    const steps = deriveStepper({ status: 'draft' }, [], [])
    expect(steps.map((s) => s.key)).toEqual(['analysis', 'methodology', 'architecture', 'roadmap', 'backlog', 'sprints'])
    expect(steps[1]).toMatchObject({ name: 'Methodology', agent: 'Agile coach', state: 'not_started', proposal: null })
  })

  it('approved: the newest proposal is approved or adjusted', () => {
    const steps = deriveStepper({ status: 'planning' }, [proposal('analysis', 'rejected', 1), proposal('analysis', 'approved', 2), proposal('methodology', 'adjusted', 3)], [])
    expect(states(steps)).toMatchObject({ analysis: 'approved', methodology: 'approved' })
  })

  it('waiting: the newest proposal is pending', () => {
    const steps = deriveStepper({ status: 'planning' }, [proposal('analysis', 'approved', 1), proposal('methodology', 'pending', 2)], [])
    expect(states(steps)).toMatchObject({ methodology: 'waiting', architecture: 'not_started' })
  })

  it('working: the first stage that is not approved while planning', () => {
    const steps = deriveStepper({ status: 'planning' }, [proposal('analysis', 'approved', 1)], [])
    expect(states(steps)).toMatchObject({ analysis: 'approved', methodology: 'working', architecture: 'not_started' })
  })

  it('working again after one rejection, while the agent redoes it', () => {
    const steps = deriveStepper({ status: 'planning' }, [proposal('analysis', 'rejected', 1)], [])
    expect(states(steps).analysis).toBe('working')
  })

  it('needs_leader: three rejections in a row', () => {
    const steps = deriveStepper({ status: 'planning' }, [1, 2, 3].map((m) => proposal('analysis', 'rejected', m)), [])
    expect(steps[0]).toMatchObject({ state: 'needs_leader' })
    expect(steps[0].proposal?.status).toBe('rejected')
  })

  it('not needs_leader when an approval sits between the rejections', () => {
    const steps = deriveStepper({ status: 'planning' }, [proposal('analysis', 'rejected', 1), proposal('analysis', 'approved', 2), proposal('analysis', 'rejected', 3), proposal('analysis', 'rejected', 4)], [])
    expect(states(steps).analysis).toBe('working')
  })

  it('needs_leader: a stage_needs_leader event newer than its newest proposal', () => {
    const steps = deriveStepper({ status: 'planning' }, [proposal('analysis', 'rejected', 5)], [event(9, 5, { type: 'stage_needs_leader', stage: 'analysis', rejections: 3 } as never)])
    expect(states(steps).analysis).toBe('needs_leader')
    const older = deriveStepper({ status: 'planning' }, [proposal('analysis', 'rejected', 7)], [event(9, 5, { type: 'stage_needs_leader', stage: 'analysis', rejections: 3 } as never)])
    expect(states(older).analysis).toBe('working')
  })

  it('failed: the project is in error, on the first stage that is not approved, with the newest reason', () => {
    const steps = deriveStepper({ status: 'error' }, [proposal('analysis', 'approved', 1)], [
      event(3, 2, { type: 'plan_failed', agent: 'methodology', error: 'Old reason' } as never),
      event(7, 4, { type: 'plan_failed', agent: 'methodology', error: 'The agent took too long.' } as never),
    ])
    expect(steps[1]).toMatchObject({ state: 'failed', reason: 'The agent took too long.' })
    expect(states(steps).architecture).toBe('not_started')
  })

  it('not_started: anything else, like a draft project', () => {
    expect(Object.values(states(deriveStepper({ status: 'draft' }, [], [])))).toEqual(Array(6).fill('not_started'))
  })

  it('focuses the first stage that is not approved, and knows when the plan is complete', () => {
    const all = (['analysis', 'methodology', 'architecture', 'roadmap', 'backlog', 'sprints'] as StageKey[]).map((k, i) => proposal(k, 'approved', i))
    const done = deriveStepper({ status: 'ready' }, all, [])
    expect(planComplete(done)).toBe(true)
    expect(focusStep(done).key).toBe('sprints')
    const halfway = deriveStepper({ status: 'planning' }, all.slice(0, 2), [])
    expect(focusStep(halfway).key).toBe('architecture')
  })
})
