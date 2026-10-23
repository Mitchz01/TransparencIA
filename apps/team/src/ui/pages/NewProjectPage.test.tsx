import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { createFakeBackend, FakeStore } from '../../adapters/fake'
import { renderApp } from '../../test/renderApp'

const backend = createFakeBackend({ store: new FakeStore(false), stageDelayMs: 50 })
afterEach(() => backend.planning.dispose())

async function fillProject(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByRole('textbox', { name: 'Nombre del proyecto' }), 'Online store')
  await user.type(screen.getByRole('textbox', { name: 'Descripción' }), 'A store for handmade furniture.')
}

describe('New project (spec 015, US3)', () => {
  it('makes you its only member, as leader with your profile, and opens the team to share the link', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/projects/new', backend)

    await fillProject(user)
    expect(screen.queryByRole('list', { name: 'Miembros del equipo' })).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Tu cargo en este proyecto' })).toHaveValue('Representante legal')
    await user.click(screen.getByRole('button', { name: 'Registrar proyecto' }))

    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/projects\/\d+\/team$/))
    const project = [...backend.store.projects.values()].at(-1)!
    expect(project).toMatchObject({ name: 'Online store', status: 'draft' })
    expect(project.members).toEqual([expect.objectContaining({ name: 'Fundación Manglares Vivos', role: 'Representante legal', seniority: 'senior', permission: 'leader', account_id: 1 })])
    const link = await screen.findByRole('textbox', { name: 'Link de invitación' })
    expect((link as HTMLInputElement).value).toMatch(/\/join\/\w+$/)
  })

  it('asks for your role when your profile has none, and keeps what was typed', async () => {
    const user = userEvent.setup()
    const store = new FakeStore(false)
    store.accounts.get(1)!.role = null
    const local = createFakeBackend({ store, stageDelayMs: 50 })
    renderApp('/projects/new', local)

    await fillProject(user)
    const role = screen.getByRole('textbox', { name: 'Tu cargo en este proyecto' })
    expect(role).toHaveValue('')
    await user.click(screen.getByRole('button', { name: 'Registrar proyecto' }))

    expect(role).toHaveAccessibleDescription('Obligatorio.')
    expect(role).toHaveFocus()
    expect(screen.getByRole('textbox', { name: 'Nombre del proyecto' })).toHaveValue('Online store')
    expect(store.projects.size).toBe(0)
    local.planning.dispose()
  })
})
