import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createFakeBackend, FakeStore } from '../../adapters/fake'
import { renderApp } from '../../test/renderApp'

describe('Settings', () => {
  it('saves the project and points to the team, which has its own screen (spec 015)', async () => {
    const user = userEvent.setup()
    const backend = createFakeBackend({ store: new FakeStore(), stageDelayMs: 10 })
    renderApp('/projects/2/settings', backend)

    const name = await screen.findByRole('textbox', { name: 'Nombre del proyecto' })
    expect(screen.queryByRole('list', { name: 'Miembros del equipo' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir al equipo' })).toHaveAttribute('href', '/projects/2/team')
    await user.clear(name)
    await user.type(name, 'Tienda de muebles')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(backend.store.projects.get(2)!.name).toBe('Tienda de muebles'))
    expect(await screen.findByText('Cambios guardados.')).toBeInTheDocument()
  })

  it('locks the methodology once planning started, and says why', async () => {
    renderApp('/projects/1/settings')
    const methodology = await screen.findByRole('combobox', { name: 'Metodología' })
    expect(methodology).toBeDisabled()
    expect(methodology).toHaveAccessibleDescription('La planificación ya empezó, así que la metodología no se puede cambiar.')
  })
})
