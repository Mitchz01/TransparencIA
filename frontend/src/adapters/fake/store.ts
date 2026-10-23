// In-memory backend for working on screens without the API (VITE_USE_FAKE).
// It follows the same contract: same shapes, same error codes, events with increasing seq.

import { ApiError, type ApiErrorBody, type FieldError } from '../../application/errors'
import type { DomainEvent } from '../../domain/events'
import type { Project } from '../../domain/project'
import type { Proposal } from '../../domain/proposals'
import { demoProject, demoProposals } from './demoData'

type Listener = (event: DomainEvent) => void

// Distributive Omit: keeps each member of the DomainEvent union apart.
type NewEvent = DomainEvent extends infer E ? (E extends DomainEvent ? Omit<E, 'seq' | 'occurred_at'> : never) : never

export class FakeStore {
  projects = new Map<number, Project>()
  proposals = new Map<number, Proposal>()
  events: DomainEvent[] = []
  private listeners = new Map<number, Set<Listener>>()
  private nextId = 1000
  private nextSeq = 1

  constructor(seed = true) {
    if (!seed) return
    this.projects.set(demoProject.id, structuredClone(demoProject))
    for (const proposal of demoProposals) this.proposals.set(proposal.id, structuredClone(proposal))
  }

  id(): number {
    return this.nextId++
  }

  now(): string {
    return new Date().toISOString()
  }

  publish(event: NewEvent): void {
    const saved = { ...event, seq: this.nextSeq++, occurred_at: this.now() } as DomainEvent
    this.events.push(saved)
    for (const listener of this.listeners.get(saved.project_id) ?? []) listener(saved)
  }

  subscribe(projectId: number, listener: Listener): () => void {
    const set = this.listeners.get(projectId) ?? new Set<Listener>()
    set.add(listener)
    this.listeners.set(projectId, set)
    return () => set.delete(listener)
  }
}

/** Every fake call is async and returns copies, like a network round trip would. */
export async function reply<T>(value: T): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, 80))
  return structuredClone(value)
}

export function fail(status: number, body: ApiErrorBody): never {
  throw new ApiError(status, body, `fake-${crypto.randomUUID()}`)
}

export const notFound = (entity: 'project' | 'proposal', id: number): never =>
  fail(404, { code: `${entity}_not_found`, detail: `${entity[0].toUpperCase()}${entity.slice(1)} ${id} does not exist.` })

export const invalid = (errors: FieldError[], detail = 'The request has invalid fields.'): never =>
  fail(422, { code: 'validation_failed', detail, errors })
