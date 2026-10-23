import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { hasCode } from '../../application/errors'
import { createFakeBackend, FakeStore } from '../../adapters/fake'
import { renderApp } from '../../test/renderApp'

const seeded = () => createFakeBackend({ store: new FakeStore(), stageDelayMs: 10 })

/** The seeded backend, signed in as Leo: a member (not a leader) of both demo projects. */
function asLeo() {
  const backend = seeded()
  backend.store.signInAs('Leo')
  return backend
}

describe('Join with the link (spec 015, US4)', () => {
  it('signed out: shows the project, signs up, comes back to the link and joins', async () => {
    const user = userEvent.setup()
    const backend = seeded()
    backend.store.session = null
    const { router } = renderApp('/join/demo-1', backend)

    expect(await screen.findByText('Te invitaron a Agile Planner (demo)')).toBeInTheDocument()
    expect(screen.getByText('Líder: Ana Gómez')).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Crear cuenta' }))

    await user.type(await screen.findByRole('textbox', { name: 'Nombre' }), 'Carla Pérez')
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'carla@team.dev')
    await user.type(screen.getByLabelText('Contraseña'), 'carla-pass')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    await user.click(await screen.findByRole('button', { name: 'Omitir' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/join/demo-1'))
    const role = await screen.findByRole('textbox', { name: 'Tu rol en este proyecto' })
    await user.click(screen.getByRole('button', { name: 'Unirme' }))
    expect(role).toHaveAccessibleDescription('Dinos qué vas a hacer en este proyecto.')
    await user.type(role, 'Diseño')
    await user.click(screen.getByRole('button', { name: 'Unirme' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/projects/1/board'))
    expect(backend.store.projects.get(1)!.members.at(-1)).toMatchObject({ name: 'Carla Pérez', role: 'Diseño', permission: 'member' })
    expect(backend.store.events.at(-1)).toMatchObject({ type: 'team_changed', joined: ['Carla Pérez'] })
  })

  it('says an old or wrong link isn’t valid anymore, with a way home', async () => {
    renderApp('/join/not-a-token', seeded())
    expect(await screen.findByRole('heading', { name: 'Esta invitación ya no es válida' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir a mis proyectos' })).toHaveAttribute('href', '/')
  })
})

describe('Team screen (spec 015, US4 and US6)', () => {
  it('lets the leader replace the link, and the old one stops working', async () => {
    const user = userEvent.setup()
    const backend = seeded()
    renderApp('/projects/1/team', backend)

    const link = await screen.findByRole('textbox', { name: 'Link de invitación' })
    await waitFor(() => expect(link).toHaveValue(`${window.location.origin}/join/demo-1`))
    await user.click(screen.getByRole('button', { name: 'Crear link nuevo' }))
    const dialog = screen.getByRole('dialog', { name: 'Crear link nuevo' })
    expect(dialog).toHaveTextContent('El link anterior deja de funcionar.')
    await user.click(within(dialog).getByRole('button', { name: 'Crear link nuevo' }))

    await waitFor(() => expect(link).not.toHaveValue(`${window.location.origin}/join/demo-1`))
    await expect(backend.gateways.team.previewInvitation('demo-1')).rejects.toSatisfy((e) => hasCode(e, 'invitation_not_found'))
    const token = (link as HTMLInputElement).value.split('/join/')[1]
    await expect(backend.gateways.team.previewInvitation(token)).resolves.toMatchObject({ project_name: 'Agile Planner (demo)' })
  })

  it('says next to the leader that the project needs one when the last leader steps down', async () => {
    const user = userEvent.setup()
    const backend = seeded()
    renderApp('/projects/1/team', backend)

    await user.click(await screen.findByRole('button', { name: 'Opciones de Ana Gómez' }))
    await user.click(screen.getByRole('menuitem', { name: 'Quitar como líder' }))

    const row = screen.getByText('Ana Gómez').closest('li')!
    expect(await within(row).findByText('El proyecto necesita un líder. Primero haz líder a otra persona.')).toBeInTheDocument()
    expect(backend.store.projects.get(1)!.members[0].permission).toBe('leader')
  })

  it('lets the leader edit a member’s role in the project without touching their profile', async () => {
    const user = userEvent.setup()
    const backend = seeded()
    renderApp('/projects/1/team', backend)

    await user.click(await screen.findByRole('button', { name: 'Opciones de Leo Ruiz' }))
    await user.click(screen.getByRole('menuitem', { name: 'Editar' }))
    const dialog = screen.getByRole('dialog', { name: 'Editar a Leo Ruiz' })
    const role = within(dialog).getByRole('textbox', { name: 'Rol' })
    await user.clear(role)
    await user.type(role, 'Fullstack')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(backend.store.projects.get(1)!.members[1].role).toBe('Fullstack'))
    expect(backend.store.accounts.get(2)!.role).toBe('Frontend')
    expect(backend.store.events.at(-1)).toMatchObject({ type: 'team_changed', changed: [{ name: 'Leo Ruiz', fields: ['role'] }] })
  })

  it('lets a member leave the project, which then leaves their list', async () => {
    const user = userEvent.setup()
    const backend = asLeo()
    const { router } = renderApp('/projects/1/team', backend)

    expect(await screen.findByRole('list', { name: 'Miembros del equipo' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Link de invitación' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Opciones de/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Salir del proyecto' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Salir de Agile Planner (demo)' })).getByRole('button', { name: 'Salir del proyecto' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(backend.store.projects.get(1)!.members.some((m) => m.account_id === 2)).toBe(false)
    expect(await screen.findByRole('link', { name: /Tienda online/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Agile Planner \(demo\)/ })).not.toBeInTheDocument()
  })
})

describe('A member’s view (spec 015, US5)', () => {
  it('hides approving, replanning, closing sprints and settings, but can still move a card', async () => {
    const user = userEvent.setup()
    const backend = asLeo()
    const view = renderApp('/projects/1/planning', backend)

    expect(await screen.findByText('Esperando la aprobación del líder')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aprobar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rechazar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Ajustes' })).not.toBeInTheDocument()
    view.unmount()

    const board = backend.store.boards.get(2)!
    const task = board.tasks.find((t) => t.status === 'todo')!
    renderApp(`/projects/2/board?task=${task.id}`, backend)
    const panel = await screen.findByRole('dialog', { name: task.title })
    expect(screen.queryByRole('button', { name: 'Replanificar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cerrar sprint' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ajustar la capacidad' })).not.toBeInTheDocument()

    await user.click(within(panel).getByRole('button', { name: 'Estado: Por hacer' }))
    await user.click(screen.getByRole('menuitemradio', { name: 'En curso' }))
    await waitFor(() => expect(backend.store.boards.get(2)!.tasks.find((t) => t.id === task.id)!.status).toBe('in_progress'))
  })

  it('gets forbidden from the service for a leader action, as the API answers', async () => {
    const backend = asLeo()
    await expect(backend.gateways.proposals.approve(104)).rejects.toSatisfy((e) => hasCode(e, 'forbidden'))
    await expect(backend.gateways.projects.update(1, { name: 'Mine' })).rejects.toSatisfy((e) => hasCode(e, 'forbidden'))
    expect(backend.store.proposals.get(104)!.status).toBe('pending')
  })

  it('answers not found to someone outside the project', async () => {
    const backend = seeded()
    await backend.gateways.auth.signUp({ name: 'Beto', email: 'beto@team.dev', password: '12345678' })
    await expect(backend.gateways.projects.get(1)).rejects.toSatisfy((e) => hasCode(e, 'project_not_found'))
    await expect(backend.gateways.projects.list()).resolves.toEqual([])
  })
})
