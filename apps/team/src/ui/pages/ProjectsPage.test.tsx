import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createFakeBackend, FakeStore } from '../../adapters/fake'
import { renderApp } from '../../test/renderApp'

describe('Home launchpad (spec 016)', () => {
  it('greets you and opens the new project form prefilled on Enter', async () => {
    const user = userEvent.setup()
    const backend = createFakeBackend({ store: new FakeStore(), stageDelayMs: 10 })
    const { router } = renderApp('/', backend)

    expect(await screen.findByRole('heading', { name: '¿Qué proyecto ejecutamos hoy, Ana?' })).toBeInTheDocument()
    const box = screen.getByRole('textbox', { name: 'Describe tu proyecto' })
    expect(screen.getByRole('button', { name: 'Continuar con este proyecto' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Duración: 8 semanas' }))
    await user.click(screen.getByRole('menuitemradio', { name: '12 semanas' }))
    await user.type(box, 'Una app de citas para clínicas veterinarias{Shift>}{Enter}{/Shift}con recordatorios{Enter}')

    await waitFor(() => expect(router.state.location.pathname).toBe('/projects/new'))
    const name = await screen.findByRole('textbox', { name: 'Nombre del proyecto' })
    expect(name).toHaveValue('App de citas para clínicas')
    await waitFor(() => expect(name).toHaveFocus())
    expect(screen.getByRole('textbox', { name: 'Descripción' })).toHaveValue('Una app de citas para clínicas veterinarias\ncon recordatorios')
    expect(screen.getByRole('textbox', { name: 'Duración' })).toHaveValue('12')
    backend.planning.dispose()
  })

  it('fills the box from a template and searches the projects', async () => {
    const user = userEvent.setup()
    const backend = createFakeBackend({ store: new FakeStore(), stageDelayMs: 10 })
    renderApp('/', backend)

    const panel = await screen.findByRole('region', { name: 'Tus proyectos' })
    await within(panel).findByRole('link', { name: /Tienda online/ })
    await user.click(within(panel).getByRole('radio', { name: 'Plantillas' }))
    await user.click(within(panel).getByRole('button', { name: /Mejoramiento de vía terciaria/ }))
    expect((screen.getByRole('textbox', { name: 'Describe tu proyecto' }) as HTMLTextAreaElement).value).toContain('placa huella')

    await user.type(within(panel).getByRole('searchbox', { name: 'Buscar proyectos' }), 'zzz')
    expect(within(panel).getByText('Ningún proyecto se llama "zzz".')).toBeInTheDocument()
    backend.planning.dispose()
  })
})
