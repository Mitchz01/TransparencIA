import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createFakeBackend, FakeStore, type FakeBackend } from '../../adapters/fake'
import { renderApp } from '../../test/renderApp'

let backend: FakeBackend
let projectId: number

beforeEach(async () => {
  backend = createFakeBackend({ store: new FakeStore(false), stageDelayMs: 20 })
  const project = await backend.gateways.projects.create({
    name: 'Shop', description: 'A small online shop.', members: [{ name: 'Ana', role: 'Backend' }, { name: 'Leo', role: 'Frontend' }],
  })
  projectId = project.id
  await backend.gateways.planning.start(projectId)
})

afterEach(() => backend.planning.dispose())

const proposalCard = (stage: string) => screen.findByRole('article', { name: `Propuesta: ${stage}` }, { timeout: 3000 })
const pending = (key: string) =>
  [...backend.store.proposals.values()].filter((p) => p.key === key && p.status === 'pending')
const stageRow = (name: RegExp) => within(screen.getByRole('navigation', { name: 'Etapas de la planificación' })).getByRole('button', { name })

describe('Planning', () => {
  it('approves, adjusts and rejects proposals, and asks for a reason before rejecting', async () => {
    const user = userEvent.setup()
    renderApp(`/projects/${projectId}/planning`, backend)

    // Approve the analysis: the methodology starts next.
    const analysis = await proposalCard('Análisis')
    expect(within(analysis).getByText('Espera tu decisión')).toBeInTheDocument()
    await user.click(within(analysis).getByRole('button', { name: 'Aprobar' }))
    await waitFor(() => expect(stageRow(/Análisis/)).toHaveTextContent('Aprobada'))

    // Adjust the iteration length from 2 to 1 week and approve it.
    const methodology = await proposalCard('Metodología')
    expect(within(methodology).getByRole('heading', { name: 'Scrumban, iteraciones de 2 semanas' })).toBeInTheDocument()
    await user.click(within(methodology).getByRole('button', { name: 'Ajustar' }))
    const length = within(methodology).getByRole('textbox', { name: 'Duración de la iteración' })
    await user.clear(length)
    await user.type(length, '1')
    await user.click(within(methodology).getByRole('button', { name: 'Aprobar con cambios' }))
    await waitFor(() => expect(stageRow(/Metodología/)).toHaveTextContent('Aprobada'))
    const adjusted = [...backend.store.proposals.values()].find((p) => p.key === 'methodology')!
    expect(adjusted.status).toBe('adjusted')
    expect(adjusted.adjusted_content).toMatchObject({ sprint_length_weeks: 1 })

    await user.click(within(await proposalCard('Arquitectura')).getByRole('button', { name: 'Aprobar' }))

    // Reject the roadmap: nothing is sent without a reason.
    const roadmap = await proposalCard('Roadmap')
    await user.click(within(roadmap).getByRole('button', { name: 'Rechazar' }))
    const dialog = screen.getByRole('dialog', { name: 'Rechazar el roadmap' })
    await user.click(within(dialog).getByRole('button', { name: 'Rechazar' }))
    expect(within(dialog).getByRole('textbox', { name: 'Motivo' })).toHaveAccessibleDescription('Escribe un motivo para que el agente lo haga mejor.')
    expect(pending('roadmap')).toHaveLength(1)

    await user.type(within(dialog).getByRole('textbox', { name: 'Motivo' }), 'Ship the board earlier')
    await user.click(within(dialog).getByRole('button', { name: 'Rechazar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    // The agent redoes it with the reason.
    await waitFor(() => expect(pending('roadmap')[0]?.rationale).toContain('Ship the board earlier'), { timeout: 3000 })
    expect(await screen.findByText(/Ship the board earlier/, {}, { timeout: 3000 })).toBeInTheDocument()
  })

  it('asks for the leader after three rejections, and offers to retry or adjust', async () => {
    const user = userEvent.setup()
    renderApp(`/projects/${projectId}/planning`, backend)

    for (let i = 1; i <= 3; i++) {
      await waitFor(() => expect(pending('analysis')).toHaveLength(1), { timeout: 3000 })
      const card = await proposalCard('Análisis')
      await waitFor(() => expect(within(card).getByRole('button', { name: 'Rechazar' })).toBeEnabled())
      await user.click(within(card).getByRole('button', { name: 'Rechazar' }))
      await user.type(screen.getByRole('textbox', { name: 'Motivo' }), `Try ${i}`)
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Rechazar' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    }

    await waitFor(() => expect(stageRow(/Análisis/)).toHaveTextContent('Te necesita'), { timeout: 3000 })
    const card = await proposalCard('Análisis')
    expect(within(card).getByRole('button', { name: 'Reintentar el análisis' })).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'Ajustarla tú mismo' })).toBeInTheDocument()

    await user.click(within(card).getByRole('button', { name: 'Reintentar el análisis' }))
    await waitFor(() => expect(pending('analysis')).toHaveLength(1), { timeout: 3000 })
  })
})
