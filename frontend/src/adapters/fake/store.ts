// In-memory backend for working on screens without the API (VITE_USE_FAKE).
// It follows the same contract: same shapes, same error codes, events with increasing seq.

import { ApiError, type ApiErrorBody, type FieldError } from '../../application/errors'
import type { BoardView } from '../../domain/board'
import type { ProjectDocument } from '../../domain/documents'
import type { DomainEvent } from '../../domain/events'
import type { Connection } from '../../domain/integrations'
import type { Project } from '../../domain/project'
import type { Proposal } from '../../domain/proposals'
import { demoBoard, demoBoardProject, demoBoardProposals, demoProject, demoProposals } from './demoData'

type Listener = (event: DomainEvent) => void

// Distributive Omit: keeps each member of the DomainEvent union apart.
export type NewEvent = DomainEvent extends infer E ? (E extends DomainEvent ? Omit<E, 'seq' | 'occurred_at'> : never) : never

/** A stored document keeps the content of every version; the API only returns one at a time. */
export interface StoredDocument extends Omit<ProjectDocument, 'content'> {
  contents: Record<number, string>
  updated_at: string
}

const STORAGE_KEY = 'agile-planner.fake-store'

export class FakeStore {
  projects = new Map<number, Project>()
  proposals = new Map<number, Proposal>()
  boards = new Map<number, BoardView>()
  documents = new Map<number, StoredDocument>()
  connections = new Map<number, Connection>()
  events: DomainEvent[] = []
  private listeners = new Map<number, Set<Listener>>()
  private globalListeners = new Set<Listener>()
  private nextId = 1000
  private nextSeq = 1

  constructor(seed = true) {
    if (!seed) return
    for (const project of [demoBoardProject, demoProject]) this.projects.set(project.id, structuredClone(project))
    for (const proposal of [...demoBoardProposals, ...demoProposals]) this.proposals.set(proposal.id, structuredClone(proposal))
    this.boards.set(demoBoardProject.id, demoBoard(() => this.id()))
  }

  id(): number {
    return this.nextId++
  }

  now(): string {
    return new Date().toISOString()
  }

  publish(event: NewEvent): DomainEvent {
    const saved = { ...event, seq: this.nextSeq++, occurred_at: this.now() } as DomainEvent
    this.events.push(saved)
    for (const listener of this.globalListeners) listener(saved)
    for (const listener of this.listeners.get(saved.project_id) ?? []) listener(saved)
    return saved
  }

  subscribe(projectId: number, listener: Listener): () => void {
    const set = this.listeners.get(projectId) ?? new Set<Listener>()
    set.add(listener)
    this.listeners.set(projectId, set)
    return () => set.delete(listener)
  }

  /** Every event of every project, before the per-project listeners (the fake agents use it). */
  subscribeAll(listener: Listener): () => void {
    this.globalListeners.add(listener)
    return () => this.globalListeners.delete(listener)
  }

  // ---------- Browser persistence, so a reload keeps the demo where it was ----------

  save(storage: Storage): void {
    const snapshot = {
      projects: [...this.projects.values()],
      proposals: [...this.proposals.values()],
      boards: [...this.boards.entries()],
      documents: [...this.documents.values()],
      connections: [...this.connections.entries()],
      events: this.events,
      nextId: this.nextId,
      nextSeq: this.nextSeq,
    }
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
    } catch {
      // Storage full or blocked: the demo still works, it just won't survive a reload.
    }
  }

  restore(storage: Storage): boolean {
    let raw: string | null = null
    try {
      raw = storage.getItem(STORAGE_KEY)
    } catch {
      return false
    }
    if (!raw) return false
    try {
      const s = JSON.parse(raw)
      this.projects = new Map(s.projects.map((p: Project) => [p.id, p]))
      this.proposals = new Map(s.proposals.map((p: Proposal) => [p.id, p]))
      this.boards = new Map(s.boards)
      this.documents = new Map(s.documents.map((d: StoredDocument) => [d.id, d]))
      this.connections = new Map(s.connections)
      this.events = s.events
      this.nextId = s.nextId
      this.nextSeq = s.nextSeq
      return true
    } catch {
      return false
    }
  }

  static clear(storage: Storage): void {
    try {
      storage.removeItem(STORAGE_KEY)
    } catch {
      // Nothing to clear.
    }
  }
}

let offline = false

/** Makes every fake call fail like an unreachable server, to try the error paths. */
export function setFakeOffline(value: boolean): void {
  offline = value
}

/** Call before changing anything, so an offline call leaves the store untouched. */
export async function online(): Promise<void> {
  if (offline) {
    await new Promise((resolve) => setTimeout(resolve, 80))
    throw new ApiError(0, { code: 'network_error', detail: 'Can’t reach the server.' }, `fake-${crypto.randomUUID()}`)
  }
}

/** Every fake call is async and returns copies, like a network round trip would. */
export async function reply<T>(value: T): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, 80))
  if (offline) throw new ApiError(0, { code: 'network_error', detail: 'Can’t reach the server.' }, `fake-${crypto.randomUUID()}`)
  return structuredClone(value)
}

export function fail(status: number, body: ApiErrorBody): never {
  throw new ApiError(status, body, `fake-${crypto.randomUUID()}`)
}

type Entity = 'project' | 'proposal' | 'task' | 'sprint' | 'member' | 'document' | 'stage' | 'version'

export const notFound = (entity: Entity, id: number | string): never =>
  fail(404, { code: `${entity}_not_found`, detail: `${entity[0].toUpperCase()}${entity.slice(1)} ${id} does not exist.` })

export const invalid = (errors: FieldError[], detail = 'The request has invalid fields.'): never =>
  fail(422, { code: 'validation_failed', detail, errors })
