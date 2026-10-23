// The fake's version of the service's guards (spec 015, plan "Guards on the existing endpoints"):
// every call needs a session (401), outsiders get the resource's 404, and members get 403 on leader
// actions. One table per gateway says which project each call belongs to and what it needs.

import type { EventStream } from '../../application/ports'
import type { Member } from '../../domain/project'
import { type Entity, type FakeStore, fail, notFound } from './store'

export type Action = 'view' | 'work' | 'manage'

/** What a call needs: a session only, or an action on the project that owns `entity` `id`. */
export type Check = 'signed_in' | 'public' | { action: Action; entity: Entity; id: number }

const on = (entity: Entity) => (action: Action) => (id: number): Check => ({ action, entity, id })
export const onProject = on('project')
export const onTask = on('task')
export const onSprint = on('sprint')
export const onProposal = on('proposal')
export const onDocument = on('document')
export const onMember = on('member')

function ownerOf(store: FakeStore, entity: Entity, id: number): number | undefined {
  switch (entity) {
    case 'project':
      return store.projects.has(id) ? id : undefined
    case 'task':
      return [...store.boards.values()].find((b) => b.tasks.some((t) => t.id === id))?.project_id
    case 'sprint':
      return [...store.boards.values()].find((b) => b.sprints.some((s) => s.id === id))?.project_id
    case 'proposal':
      return store.proposals.get(id)?.project_id
    case 'document':
      return store.documents.get(id)?.project_id
    case 'member':
      return [...store.projects.values()].find((p) => p.members.some((m) => m.id === id))?.id
    default:
      return undefined
  }
}

/** The caller's member in the project, or the same errors as the service. */
export function authorize(store: FakeStore, projectId: number, action: Action, entity: Entity = 'project', id = projectId): Member {
  const account = store.signedIn()
  const found = store.projects.get(projectId)?.members.find((m) => m.account_id === account.id)
  if (!found) return notFound(entity, id)
  if (action === 'manage' && found.permission !== 'leader') fail(403, { code: 'forbidden', detail: 'Only the project’s leaders can do this.' })
  return found
}

function check(store: FakeStore, rule: Check): void {
  if (rule === 'public') return
  store.signedIn()
  if (rule === 'signed_in') return
  const projectId = ownerOf(store, rule.entity, rule.id)
  if (projectId === undefined) notFound(rule.entity, rule.id)
  else authorize(store, projectId, rule.action, rule.entity, rule.id)
}

type Rules<G> = { [K in keyof G]: G[K] extends (...args: infer A) => Promise<unknown> ? (...args: A) => Check : never }

/** The gateway with each method checked by its rule first, as the service's dependencies do before the use case. */
export function guarded<G extends object>(store: FakeStore, gateway: G, rules: Rules<G>): G {
  const wrapped: Record<string, unknown> = {}
  for (const key of Object.keys(rules) as (keyof G & string)[]) {
    const method = gateway[key] as (...args: unknown[]) => Promise<unknown>
    const rule = rules[key] as (...args: unknown[]) => Check
    wrapped[key] = async (...args: unknown[]) => {
      check(store, rule(...args))
      return method(...args)
    }
  }
  return wrapped as G
}

/** The live stream only reaches members, and ends for someone removed from the project. */
export function guardedEvents(store: FakeStore, events: EventStream): EventStream {
  const isMember = (projectId: number) =>
    store.session !== null && Boolean(store.projects.get(projectId)?.members.some((m) => m.account_id === store.session))
  return {
    subscribe(projectId, onEvent, options = {}) {
      if (!isMember(projectId)) {
        options.onError?.()
        return () => {}
      }
      let open = true
      const close = events.subscribe(projectId, (event) => {
        if (!open) return
        if (!isMember(projectId)) {
          open = false
          close()
          options.onError?.()
          return
        }
        onEvent(event)
      }, options)
      return () => {
        open = false
        close()
      }
    },
  }
}
