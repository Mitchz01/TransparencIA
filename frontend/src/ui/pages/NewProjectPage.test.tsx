import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { createFakeBackend, FakeStore } from '../../adapters/fake'
import { renderApp } from '../../test/renderApp'

const backend = createFakeBackend({ store: new FakeStore(false), stageDelayMs: 50 })
afterEach(() => backend.planning.dispose())

const rows = () => within(screen.getByRole('list', { name: 'Miembros del equipo' })).getAllByRole('listitem')

describe('New project', () => {
  it('starts with two member rows filled with the defaults, and adds and removes rows', async () => {
    const user = userEvent.setup()
    renderApp('/projects/new', backend)

    expect(rows()).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Agregar miembro' }))
    expect(rows()).toHaveLength(3)
    await user.click(within(rows()[0]).getByRole('button', { name: 'Quitar a miembro 1' }))

    expect(rows()).toHaveLength(2)
    const added = rows()[1]
    expect(within(added).getByRole('combobox', { name: 'Seniority' })).toHaveValue('mid')
    expect(within(added).getByRole('textbox', { name: 'Horas por semana' })).toHaveValue('20')
  })

  it('shows a repeated name under the second row, keeps the text, and creates the project once fixed', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/projects/new', backend)

    await user.type(screen.getByRole('textbox', { name: 'Nombre del proyecto' }), 'Online store')
    await user.type(screen.getByRole('textbox', { name: 'Descripción' }), 'A store for handmade furniture.')
    const [first, second] = rows()
    await user.type(within(first).getByRole('textbox', { name: 'Nombre' }), 'Ana')
    await user.type(within(first).getByRole('textbox', { name: 'Rol' }), 'Backend')
    await user.type(within(second).getByRole('textbox', { name: 'Nombre' }), 'Ana')
    await user.type(within(second).getByRole('textbox', { name: 'Rol' }), 'Frontend')
    await user.click(screen.getByRole('button', { name: 'Crear y planificar' }))

    const secondName = within(second).getByRole('textbox', { name: 'Nombre' })
    expect(secondName).toHaveAccessibleDescription('Nombre repetido.')
    expect(secondName).toHaveFocus()
    expect(within(first).getByRole('textbox', { name: 'Nombre' })).not.toHaveAttribute('aria-invalid')
    expect(screen.getByRole('textbox', { name: 'Nombre del proyecto' })).toHaveValue('Online store')
    expect(backend.store.projects.size).toBe(0)

    await user.clear(secondName)
    await user.type(secondName, 'Leo')
    expect(secondName).not.toHaveAttribute('aria-invalid')
    await user.click(screen.getByRole('button', { name: 'Crear y planificar' }))

    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/projects\/\d+\/planning$/))
    const [project] = backend.store.projects.values()
    expect(project).toMatchObject({ name: 'Online store', status: 'planning' })
    expect(project.members.map((m) => m.name)).toEqual(['Ana', 'Leo'])
    expect(backend.store.events.some((e) => e.type === 'agent_started' && e.agent === 'analysis')).toBe(true)
  })
})
