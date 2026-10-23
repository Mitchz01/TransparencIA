import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createFakeBackend, FakeStore } from '../../adapters/fake'
import { renderApp } from '../../test/renderApp'

// Spec 019: the home is a follow-up panel of the entity's projects.
describe('Home: follow-up panel (spec 016, spec 019)', () => {
  it('lists each project with its progress, money spent and traffic light, or what is missing', async () => {
    const backend = createFakeBackend({ store: new FakeStore(), stageDelayMs: 10 })
    renderApp('/', backend)

    expect(await screen.findByRole('heading', { name: 'Hola, Ana' })).toBeInTheDocument()
    expect(screen.queryByText(/GitHub|SaaS|Scrum/)).not.toBeInTheDocument()
    const panel = await screen.findByRole('region', { name: 'Tus proyectos' })
    // Project 2 has the demo budget (spec 017's fixture): its numbers and its light.
    const planned = (await within(panel).findByRole('link', { name: 'Tienda online' })).closest('li')!
    expect(await within(planned).findByText('En amarillo')).toBeInTheDocument()
    expect(within(planned).getByText('Avance de actividades')).toBeInTheDocument()
    // Project 1 has no budget yet.
    const draft = within(panel).getByRole('link', { name: 'Agile Planner (demo)' }).closest('li')!
    expect(await within(draft).findByText(/Sin presupuesto cargado/)).toBeInTheDocument()
    backend.planning.dispose()
  }, 30000)

  it('registers a project from an example and searches the projects', async () => {
    const user = userEvent.setup()
    const backend = createFakeBackend({ store: new FakeStore(), stageDelayMs: 10 })
    const { router } = renderApp('/', backend)

    const panel = await screen.findByRole('region', { name: 'Tus proyectos' })
    await user.type(within(panel).getByRole('searchbox', { name: 'Buscar proyectos' }), 'zzz')
    expect(within(panel).getByText('Ningún proyecto se llama "zzz".')).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Registrar proyecto' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/projects/new'))
    await user.click(await screen.findByRole('button', { name: /Mejoramiento de vía terciaria/ }))
    expect(screen.getByRole('textbox', { name: 'Nombre del proyecto' })).toHaveValue('Mejoramiento de vía terciaria')
    expect((screen.getByRole('textbox', { name: 'Descripción' }) as HTMLTextAreaElement).value).toContain('vereda El Carmen')
    expect(screen.getByRole('textbox', { name: 'Duración' })).toHaveValue('39')
    backend.planning.dispose()
  }, 30000)
})
