import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createFakeBackend, FakeStore } from '../adapters/fake'
import { createQueryClient } from '../app/App'
import type { DomainEvent } from '../domain/events'
import { GatewaysContext } from './gateways'
import { applyEvent, keysForEvent, useLiveUpdates } from './liveUpdates'
import { queryKeys } from './queryKeys'

function setup() {
  const backend = createFakeBackend({ store: new FakeStore(), stageDelayMs: 10 })
  const client = createQueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <GatewaysContext.Provider value={backend.gateways}>{children}</GatewaysContext.Provider>
    </QueryClientProvider>
  )
  return { backend, client, wrapper }
}

const feed = (client: ReturnType<typeof createQueryClient>) => client.getQueryData<DomainEvent[]>(queryKeys.activity(2)) ?? []

const taskUpdated = (store: FakeStore, summary: string) =>
  store.publish({ type: 'task_updated', project_id: 2, actor: 'person', summary, ref: { kind: 'task', id: 1 }, task_id: 1 })

describe('live updates', () => {
  it('prepends new events to the feed and refetches what they changed', async () => {
    const { backend, client, wrapper } = setup()
    renderHook(() => useLiveUpdates(2), { wrapper })
    await waitFor(() => expect(client.getQueryData(queryKeys.activity(2))).toBeDefined())
    const invalidate = vi.spyOn(client, 'invalidateQueries')

    await waitFor(() => {
      taskUpdated(backend.store, 'US-2 se actualizó')
      expect(feed(client)[0]?.summary).toBe('US-2 se actualizó')
    })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.board(2) })
  })

  it('replays what was missed between loading the feed and opening the stream, in order and once', async () => {
    const { backend, client, wrapper } = setup()
    taskUpdated(backend.store, 'Antes de abrir')
    const first = await backend.gateways.activity.list(2)
    client.setQueryData(queryKeys.activity(2), first)
    taskUpdated(backend.store, 'Perdido 1')
    taskUpdated(backend.store, 'Perdido 2')

    renderHook(() => useLiveUpdates(2), { wrapper })
    await waitFor(() => expect(feed(client).slice(0, 3).map((e) => e.summary)).toEqual(['Perdido 2', 'Perdido 1', 'Antes de abrir']))
  })

  it('refetches everything on resync, when too many events were missed', () => {
    const { client } = setup()
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const resync = { type: 'resync', seq: 9, project_id: 2, occurred_at: '', actor: 'system', summary: '', ref: null } as DomainEvent
    expect(keysForEvent(resync)).toBeNull()
    applyEvent(client, resync)
    expect(invalidate).toHaveBeenCalledWith()
    expect(feed(client)).toEqual([])
  })

  it('ignores an event it already has', () => {
    const { client } = setup()
    const event = { type: 'plan_completed', seq: 5, project_id: 2, occurred_at: '', actor: 'system', summary: 'Listo', ref: null } as DomainEvent
    client.setQueryData(queryKeys.activity(2), [event])
    applyEvent(client, event)
    expect(feed(client)).toHaveLength(1)
  })
})
