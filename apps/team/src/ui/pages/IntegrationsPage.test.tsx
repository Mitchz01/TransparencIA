import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createFakeBackend, FakeStore } from '../../adapters/fake'
import { renderApp } from '../../test/renderApp'

describe('Integrations', () => {
  it('explains a repo without access, connects one, and publishes the tasks as issues', async () => {
    const user = userEvent.setup()
    const backend = createFakeBackend({ store: new FakeStore(), stageDelayMs: 10 })
    renderApp('/projects/2/integrations', backend)

    expect(await screen.findByText(/Modo de prueba: nada se envía a GitHub/)).toBeInTheDocument()
    const repo = screen.getByRole('textbox', { name: 'Repositorio' })
    await user.type(repo, 'acme/privado')
    await user.click(screen.getByRole('button', { name: 'Conectar' }))
    expect(await screen.findByText('El token no ve este repo. Dale acceso o usa otro token.')).toBeInTheDocument()
    expect(backend.store.projects.get(2)!.repository).toBeNull()

    await user.clear(repo)
    await user.type(repo, 'acme/tienda')
    await user.click(screen.getByRole('button', { name: 'Conectar' }))
    await waitFor(() => expect(backend.store.projects.get(2)!.repository).toBe('acme/tienda'))

    const publish = await screen.findByRole('button', { name: 'Publicar tareas pendientes' })
    await waitFor(() => expect(publish).toBeEnabled())
    await user.click(publish)
    const proposal = await screen.findByRole('article', { name: 'Publicar 11 issues' }, { timeout: 3000 })
    await user.click(within(proposal).getByRole('button', { name: 'Publicar' }))

    await waitFor(() => expect(backend.store.boards.get(2)!.tasks.every((t) => t.issue)).toBe(true))
    expect(backend.store.events.at(-1)).toMatchObject({ type: 'issues_published' })
  })

  it('never shows a saved token, only that there is one', async () => {
    const backend = createFakeBackend({ store: new FakeStore(), stageDelayMs: 10 })
    await backend.gateways.integrations.connect(2, { repository: 'acme/tienda', token: 'secreto' })
    renderApp('/projects/2/integrations', backend)
    const token = await screen.findByLabelText('Token')
    expect(token).toHaveValue('')
    expect(token).toHaveAccessibleDescription('Hay un token guardado. Déjalo vacío para mantenerlo.')
  })
})
