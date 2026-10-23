import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createFakeBackend, FakeStore } from '../../adapters/fake'
import type { Task } from '../../domain/board'
import { renderApp } from '../../test/renderApp'

const PROJECT = 2 // the seeded project with a board

/** Opens the panel of a seeded task, after letting the test shape it. */
async function openTask(shape: (task: Task) => Partial<Task> = () => ({})) {
  const backend = createFakeBackend({ store: new FakeStore(), stageDelayMs: 10 })
  const board = backend.store.boards.get(PROJECT)!
  const task = board.tasks[0]
  Object.assign(task, shape(task))
  const stored = () => backend.store.boards.get(PROJECT)!.tasks.find((t) => t.id === task.id)!
  renderApp(`/projects/${PROJECT}/board?task=${task.id}`, backend)
  const panel = await screen.findByRole('dialog', { name: task.title })
  return { backend, task, stored, panel, user: userEvent.setup() }
}

describe('Task panel (spec 011)', () => {
  it('reads like a page: properties as rows and no save button', async () => {
    const { panel } = await openTask(() => ({ priority: 'high', points: 2, status: 'in_progress' }))

    expect(within(panel).getByRole('button', { name: 'Estado: En ejecución' })).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Prioridad: Alta' })).toBeInTheDocument()
    expect(within(panel).getByRole('textbox', { name: 'Peso' })).toHaveValue('2')
    expect(within(panel).queryByRole('combobox')).not.toBeInTheDocument()
    expect(within(panel).queryByRole('button', { name: 'Guardar cambios' })).not.toBeInTheDocument()
  })

  it('saves a picked value at once and says so', async () => {
    const { panel, stored, user } = await openTask(() => ({ priority: 'high' }))

    await user.click(within(panel).getByRole('button', { name: 'Prioridad: Alta' }))
    await user.click(screen.getByRole('menuitemradio', { name: 'Media' }))

    await waitFor(() => expect(stored().priority).toBe('medium'))
    expect(await within(panel).findByText('Guardado')).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Prioridad: Media' })).toBeInTheDocument()
  })

  it('keeps a title typed when the panel closes before leaving the field', async () => {
    const { panel, stored, user } = await openTask()
    const title = within(panel).getByRole('textbox', { name: 'Título' })

    await user.clear(title)
    await user.type(title, 'Nuevo título')
    fireEvent.mouseDown(panel.parentElement!) // the scrim: closes without moving the focus first

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(stored().title).toBe('Nuevo título'))
  })

  it('puts the saved title back on Escape and keeps the panel open', async () => {
    const { panel, task, stored, user } = await openTask()
    const title = within(panel).getByRole('textbox', { name: 'Título' })

    await user.clear(title)
    await user.type(title, 'Otra cosa')
    await user.keyboard('{Escape}')

    expect(title).toHaveValue(task.title)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(stored().title).toBe(task.title)
  })

  it("doesn't send points out of range and says why under the field", async () => {
    const { panel, stored, user } = await openTask(() => ({ points: 3 }))
    const points = within(panel).getByRole('textbox', { name: 'Peso' })

    await user.clear(points)
    await user.type(points, '150{Enter}')

    expect(await within(panel).findByText('Entre 0 y 100.')).toBeInTheDocument()
    expect(points).toHaveValue('150')
    expect(stored().points).toBe(3)
  })

  it('shows a missing role in the assignee row until someone is assigned', async () => {
    const { panel, backend, stored, user } = await openTask(() => ({ assignee_id: null, missing_role: 'DevOps' }))
    const member = backend.store.projects.get(PROJECT)!.members[0]

    const row = within(panel).getByRole('button', { name: 'Responsable: falta DevOps' })
    expect(within(row).getByText('Falta DevOps')).toBeInTheDocument()

    await user.click(row)
    await user.click(screen.getByRole('menuitemradio', { name: new RegExp(member.name) }))

    await waitFor(() => expect(stored().assignee_id).toBe(member.id))
    expect(await within(panel).findByRole('button', { name: `Responsable: ${member.name}` })).toBeInTheDocument()
    expect(within(panel).queryByText('Falta DevOps')).not.toBeInTheDocument()
  })
})
