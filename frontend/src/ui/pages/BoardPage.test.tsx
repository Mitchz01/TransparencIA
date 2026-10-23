import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createFakeBackend, FakeStore } from '../../adapters/fake'
import { renderApp } from '../../test/renderApp'

const PROJECT = 2 // the seeded project with a board

describe('Board cards (spec 013)', () => {
  it('show the title, the priority and who has it, but not the description', async () => {
    const backend = createFakeBackend({ store: new FakeStore(), stageDelayMs: 10 })
    const member = backend.store.projects.get(PROJECT)!.members[0]
    const task = backend.store.boards.get(PROJECT)!.tasks[0]
    Object.assign(task, { priority: 'high', assignee_id: member.id, missing_role: null, description: 'Texto que vive en el panel' })
    renderApp(`/projects/${PROJECT}/board?sprint=${task.sprint_id}`, backend)

    const card = await screen.findByRole('button', { name: `${task.key} ${task.title}` })

    expect(within(card).getByText(task.title)).toBeInTheDocument()
    expect(within(card).getByText('Alta')).toBeInTheDocument()
    expect(within(card).getByText(member.name)).toBeInTheDocument()
    expect(within(card).queryByText('Texto que vive en el panel')).not.toBeInTheDocument()
  })
})
