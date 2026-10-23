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

const proposalCard = (stage: string) => screen.findByRole('article', { name: `${stage} proposal` }, { timeout: 3000 })
const pending = (key: string) =>
  [...backend.store.proposals.values()].filter((p) => p.key === key && p.status === 'pending')
const stageRow = (name: RegExp) => within(screen.getByRole('navigation', { name: 'Planning stages' })).getByRole('button', { name })

describe('Planning', () => {
  it('approves, adjusts and rejects proposals, and asks for a reason before rejecting', async () => {
    const user = userEvent.setup()
    renderApp(`/projects/${projectId}/planning`, backend)

    // Approve the analysis: the methodology starts next.
    const analysis = await proposalCard('Analysis')
    expect(within(analysis).getByText('Waiting for you')).toBeInTheDocument()
    await user.click(within(analysis).getByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(stageRow(/Analysis/)).toHaveTextContent('Approved'))

    // Adjust the iteration length from 2 to 1 week and approve it.
    const methodology = await proposalCard('Methodology')
    expect(within(methodology).getByRole('heading', { name: 'Scrumban, 2-week iterations' })).toBeInTheDocument()
    await user.click(within(methodology).getByRole('button', { name: 'Adjust' }))
    const length = within(methodology).getByRole('textbox', { name: 'Iteration length' })
    await user.clear(length)
    await user.type(length, '1')
    await user.click(within(methodology).getByRole('button', { name: 'Approve with changes' }))
    await waitFor(() => expect(stageRow(/Methodology/)).toHaveTextContent('Approved'))
    const adjusted = [...backend.store.proposals.values()].find((p) => p.key === 'methodology')!
    expect(adjusted.status).toBe('adjusted')
    expect(adjusted.adjusted_content).toMatchObject({ sprint_length_weeks: 1 })

    await user.click(within(await proposalCard('Architecture')).getByRole('button', { name: 'Approve' }))

    // Reject the roadmap: nothing is sent without a reason.
    const roadmap = await proposalCard('Roadmap')
    await user.click(within(roadmap).getByRole('button', { name: 'Reject' }))
    const dialog = screen.getByRole('dialog', { name: 'Reject the roadmap' })
    await user.click(within(dialog).getByRole('button', { name: 'Reject' }))
    expect(within(dialog).getByRole('textbox', { name: 'Reason' })).toHaveAccessibleDescription('Write a reason so the agent can do better.')
    expect(pending('roadmap')).toHaveLength(1)

    await user.type(within(dialog).getByRole('textbox', { name: 'Reason' }), 'Ship the board earlier')
    await user.click(within(dialog).getByRole('button', { name: 'Reject' }))
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
      const card = await proposalCard('Analysis')
      await waitFor(() => expect(within(card).getByRole('button', { name: 'Reject' })).toBeEnabled())
      await user.click(within(card).getByRole('button', { name: 'Reject' }))
      await user.type(screen.getByRole('textbox', { name: 'Reason' }), `Try ${i}`)
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reject' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    }

    await waitFor(() => expect(stageRow(/Analysis/)).toHaveTextContent('Needs you'), { timeout: 3000 })
    const card = await proposalCard('Analysis')
    expect(within(card).getByRole('button', { name: 'Retry the analysis' })).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'Adjust it yourself' })).toBeInTheDocument()

    await user.click(within(card).getByRole('button', { name: 'Retry the analysis' }))
    await waitFor(() => expect(pending('analysis')).toHaveLength(1), { timeout: 3000 })
  })
})
