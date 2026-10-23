// In-memory backend for working on screens without the API (VITE_USE_FAKE).
// It follows the same contract: same shapes, same error codes, events with increasing seq.

import { ApiError, type ApiErrorBody, type FieldError } from '../../application/errors'
import type { BoardView } from '../../domain/board'
import type { ProjectDocument } from '../../domain/documents'
import type { DomainEvent } from '../../domain/events'
import type { Connection } from '../../domain/integrations'
import type { Project } from '../../domain/project'
import type { Proposal } from '../../domain/proposals'
import { boardCreatedAt, seedDocuments } from './seedDocuments'
import {
  demoAccounts, demoBoard, demoBoardProject, demoBoardProposals, demoHistory, demoProject, demoProposals, type FakeAccount,
} from './demoData'

type Listener = (event: DomainEvent) => void

// Distributive Omit: keeps each member of the DomainEvent union apart.
export type NewEvent = DomainEvent extends infer E ? (E extends DomainEvent ? Omit<E, 'seq' | 'occurred_at'> : never) : never

/** A stored document keeps the content of every version; the API only returns one at a time. */
export interface StoredDocument extends Omit<ProjectDocument, 'content'> {
  key: string // the proposal key that creates and updates it
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
  /** Spec 015: accounts with their password, the signed-in one (this device's session) and each project's invitation token. */
  accounts = new Map<number, FakeAccount>()
  session: number | null = null
  invitations = new Map<number, string | null>()
  events: DomainEvent[] = []
  private listeners = new Map<number, Set<Listener>>()
  private globalListeners = new Set<Listener>()
  private nextId = 1000
  private nextSeq = 1

  /** Always starts signed in as the demo leader; `seed` adds the demo projects. */
  constructor(seed = true) {
    for (const account of demoAccounts) this.accounts.set(account.id, structuredClone(account))
    this.session = demoAccounts[0].id
    if (!seed) return
    for (const project of [demoBoardProject, demoProject]) {
      this.projects.set(project.id, structuredClone(project))
      this.invitations.set(project.id, `demo-${project.id}`)
    }
    for (const proposal of [...demoBoardProposals, ...demoProposals]) this.proposals.set(proposal.id, structuredClone(proposal))
    this.boards.set(demoBoardProject.id, demoBoard(() => this.id()))
    seedDocuments(this, demoBoardProject, boardCreatedAt)
    for (const [event, at] of demoHistory(this.boards.get(demoBoardProject.id)!)) this.record(event, at)
  }

  /** Stores a past event (demo history) without notifying anyone. */
  private record(event: NewEvent, at: string): void {
    this.events.push({ ...event, seq: this.nextSeq++, occurred_at: at } as DomainEvent)
  }

  id(): number {
    return this.nextId++
  }

  now(): string {
    return new Date().toISOString()
  }

  /** A fresh invitation token, unguessable like the service's. */
  token(): string {
    return crypto.randomUUID().replaceAll('-', '').slice(0, 22)
  }

  /** The signed-in account, or 401 not_authenticated like the real API. */
  signedIn(): FakeAccount {
    const account = this.session === null ? undefined : this.accounts.get(this.session)
    return account ?? fail(401, { code: 'not_authenticated', detail: 'Sign in to continue.' })
  }

  /** Demo helper: switches the session to the account whose name starts with `name` ("Leo"). */
  signInAs(name: string): FakeAccount {
    const wanted = name.trim().toLowerCase()
    const account = [...this.accounts.values()].find((a) => a.name.toLowerCase().startsWith(wanted) || a.email === wanted)
    if (!account) throw new Error(`No demo account named ${name}`)
    this.session = account.id
    return account
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
      accounts: [...this.accounts.values()],
      session: this.session,
      invitations: [...this.invitations.entries()],
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
      // A demo saved before accounts existed (spec 015) can't be used: start from the seed.
      if (!Array.isArray(s.accounts)) return false
      this.projects = new Map(s.projects.map((p: Project) => [p.id, p]))
      this.proposals = new Map(s.proposals.map((p: Proposal) => [p.id, p]))
      this.boards = new Map(s.boards)
      this.documents = new Map(s.documents.map((d: StoredDocument) => [d.id, d]))
      this.connections = new Map(s.connections)
      this.accounts = new Map(s.accounts.map((a: FakeAccount) => [a.id, a]))
      this.session = s.session ?? null
      this.invitations = new Map(s.invitations)
      this.events = s.events
      this.nextId = s.nextId
      this.nextSeq = s.nextSeq
      this.backfillPhotos()
      return true
    } catch {
      return false
    }
  }

  /** A demo saved before the profile photos: the demo people get theirs. A photo that was set
   *  or cleared (null) since is kept; only a missing one is filled. */
  private backfillPhotos(): void {
    const byEmail = new Map(demoAccounts.map((a) => [a.email, a.avatar_url]))
    const guests = new Map(demoBoardProject.members.filter((m) => m.account_id === null).map((m) => [m.name, m.avatar_url]))
    for (const account of this.accounts.values()) {
      if (account.avatar_url === undefined) account.avatar_url = byEmail.get(account.email) ?? null
    }
    for (const project of this.projects.values()) {
      for (const member of project.members) {
        if (member.avatar_url !== undefined) continue
        member.avatar_url = member.account_id !== null ? this.accounts.get(member.account_id)?.avatar_url : guests.get(member.name)
      }
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

export type Entity = 'project' | 'proposal' | 'task' | 'sprint' | 'member' | 'document' | 'stage' | 'version'

export const notFound = (entity: Entity, id: number | string): never =>
  fail(404, { code: `${entity}_not_found`, detail: `No existe (${entity} ${id}).` })

export const invalid = (errors: FieldError[], detail = 'La solicitud tiene campos con errores.'): never =>
  fail(422, { code: 'validation_failed', detail, errors })
