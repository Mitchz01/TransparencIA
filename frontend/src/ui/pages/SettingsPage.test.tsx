import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createFakeBackend, FakeStore } from '../../adapters/fake'
import { renderApp } from '../../test/renderApp'

describe('Settings', () => {
  it('saves a member’s new hours and tells the team changed', async () => {
    const user = userEvent.setup()
    const backend = createFakeBackend({ store: new FakeStore(), stageDelayMs: 10 })
    renderApp('/projects/2/settings', backend)

    const rows = within(await screen.findByRole('list', { name: 'Miembros del equipo' })).getAllByRole('listitem')
    const hours = within(rows[2]).getByRole('textbox', { name: 'Horas por semana' })
    expect(hours).toHaveValue('20')
    await user.clear(hours)
    await user.type(hours, '25')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(backend.store.projects.get(2)!.members[2].hours_per_week).toBe(25))
    expect(await screen.findByText('Cambios guardados.')).toBeInTheDocument()
    expect(backend.store.events.at(-1)).toMatchObject({ type: 'team_changed', changed: [{ name: 'Sara Vidal', fields: ['hours_per_week'] }] })
  })

  it('locks the methodology once planning started, and says why', async () => {
    renderApp('/projects/1/settings')
    const methodology = await screen.findByRole('combobox', { name: 'Metodología' })
    expect(methodology).toBeDisabled()
    expect(methodology).toHaveAccessibleDescription('La planificación ya empezó, así que la metodología no se puede cambiar.')
  })
})
