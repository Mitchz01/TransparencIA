import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createFakeBackend, FakeStore } from '../../adapters/fake'
import { renderApp } from '../../test/renderApp'

describe('Replan', () => {
  it('drops one change and applies the rest', async () => {
    const user = userEvent.setup()
    const backend = createFakeBackend({ store: new FakeStore(), stageDelayMs: 20 })
    renderApp('/projects/2/board', backend)

    await user.click(await screen.findByRole('button', { name: 'Replanificar' }))
    const dialog = screen.getByRole('dialog', { name: 'Replanificar' })
    await user.click(within(dialog).getByRole('button', { name: 'Pedir replan' }))
    expect(within(dialog).getByRole('textbox', { name: 'Motivo' })).toHaveAccessibleDescription('Cuéntale al agente qué cambió.')
    await user.type(within(dialog).getByRole('textbox', { name: 'Motivo' }), 'El pago es más urgente')
    await user.click(within(dialog).getByRole('button', { name: 'Pedir replan' }))

    const diff = await screen.findByRole('article', { name: 'Replan propuesto' }, { timeout: 3000 })
    const boxes = within(diff).getAllByRole('checkbox')
    await user.click(boxes[boxes.length - 1])
    await user.click(within(diff).getByRole('button', { name: `Aprobar ${boxes.length - 1} cambios` }))

    await waitFor(() => expect(backend.store.events.at(-1)?.type).toBe('replan_applied'))
    const applied = backend.store.events.at(-1)
    expect(applied).toMatchObject({ applied: expect.any(Array) })
    expect((applied as { applied: string[] }).applied).toHaveLength(boxes.length - 1)
    const proposal = [...backend.store.proposals.values()].find((p) => p.kind === 'replan')!
    expect(proposal.status).toBe('adjusted')
  })

  it('closing a sprint with unfinished work proposes an automatic replan that waits for the leader', async () => {
    const user = userEvent.setup()
    const backend = createFakeBackend({ store: new FakeStore(), stageDelayMs: 20 })
    renderApp('/projects/2/board', backend)

    await user.click(await screen.findByRole('button', { name: 'Cerrar sprint' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cerrar sprint' }))

    expect(await screen.findByText('Lo pidió el cierre del sprint', {}, { timeout: 3000 })).toBeInTheDocument()
    const replan = [...backend.store.proposals.values()].find((p) => p.kind === 'replan')!
    expect(replan).toMatchObject({ origin: 'automatic', status: 'pending' })
    expect(backend.store.boards.get(2)!.sprints[0].closed).toBe(true)
  })
})
