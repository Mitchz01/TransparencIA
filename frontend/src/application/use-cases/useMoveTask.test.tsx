import { QueryClientProvider } from '@tanstack/react-query'
import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { createFakeBackend, FakeStore, setFakeOffline } from '../../adapters/fake'
import { createQueryClient } from '../../app/App'
import type { BoardView } from '../../domain/board'
import { columnTasks, wipWarnings } from '../../domain/rules'
import { Toaster } from '../../ui/components/ds'
import { GatewaysContext } from '../gateways'
import { queryKeys } from '../queryKeys'
import { ToastProvider } from '../toasts'
import { useBoard, useMoveTask } from './useBoard'

const PROJECT = 2 // the seeded project with a board

function setup() {
  const backend = createFakeBackend({ store: new FakeStore(), stageDelayMs: 10 })
  const client = createQueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <GatewaysContext.Provider value={backend.gateways}>
        <ToastProvider>
          {children}
          <Toaster />
        </ToastProvider>
      </GatewaysContext.Provider>
    </QueryClientProvider>
  )
  const hook = renderHook(() => ({ board: useBoard(PROJECT), move: useMoveTask(PROJECT) }), { wrapper })
  return { backend, client, hook, wrapper }
}

const cached = (client: ReturnType<typeof createQueryClient>) => client.getQueryData<BoardView>(queryKeys.board(PROJECT))!

afterEach(() => setFakeOffline(false))

describe('useMoveTask', () => {
  it('moves the card in the cache before the server answers, and the server keeps it', async () => {
    const { client, hook, backend } = setup()
    await waitFor(() => expect(hook.result.current.board.data).toBeDefined())
    const sprint = cached(client).sprints[1].id // sprint 2 has everything to do
    const card = columnTasks(cached(client).tasks, 'todo', sprint)[0]

    act(() => hook.result.current.move.mutate({ taskId: card.id, status: 'in_progress', position: 0 }))
    await waitFor(() => expect(cached(client).tasks.find((t) => t.id === card.id)?.status).toBe('in_progress'))
    expect(hook.result.current.move.isPending).toBe(true) // shown before the server answered

    await waitFor(() => expect(hook.result.current.move.isSuccess).toBe(true))
    expect(backend.store.boards.get(PROJECT)!.tasks.find((t) => t.id === card.id)?.status).toBe('in_progress')
  })

  it('puts the card back and offers a retry when saving fails', async () => {
    const { client, hook, wrapper } = setup()
    await waitFor(() => expect(hook.result.current.board.data).toBeDefined())
    const sprint = cached(client).sprints[1].id // sprint 2 has everything to do
    const card = columnTasks(cached(client).tasks, 'todo', sprint)[0]
    render(<></>, { wrapper })

    setFakeOffline(true)
    act(() => hook.result.current.move.mutate({ taskId: card.id, status: 'done', position: 0 }))
    await waitFor(() => expect(hook.result.current.move.isError).toBe(true))

    expect(cached(client).tasks.find((t) => t.id === card.id)?.status).toBe('todo')
    expect(await screen.findByText(/No se pudo guardar el movimiento/)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Reintentar' }).length).toBeGreaterThan(0)
  })

  it('keeps a move over the WIP limit and the column warns about it', async () => {
    const { client, hook } = setup()
    await waitFor(() => expect(hook.result.current.board.data).toBeDefined())
    const view = cached(client)
    const sprint = view.sprints[0].id
    const limit = view.wip_limits.find((w) => w.column === 'review')!.limit // 2, with 1 card there
    const [first, second] = columnTasks(view.tasks, 'in_progress', sprint)

    for (const card of [first, second]) {
      act(() => hook.result.current.move.mutate({ taskId: card.id, status: 'review', position: 0 }))
      await waitFor(() => expect(hook.result.current.move.isPending).toBe(false))
    }
    await waitFor(() => expect(columnTasks(cached(client).tasks, 'review', sprint)).toHaveLength(limit + 1))
    expect(wipWarnings(cached(client).tasks, cached(client).wip_limits, sprint)).toEqual([
      { code: 'wip_limit_exceeded', column: 'review', limit, count: limit + 1 },
    ])
  })
})
