import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createFakeBackend, FakeStore } from '../../adapters/fake'
import { renderApp } from '../../test/renderApp'

const PROJECT = 2 // the seeded project with a board

function seeded() {
  const backend = createFakeBackend({ store: new FakeStore(), stageDelayMs: 10 })
  const board = backend.store.boards.get(PROJECT)!
  const project = backend.store.projects.get(PROJECT)!
  const sprint = board.sprints.find((s) => s.number === 1)!
  return { backend, board, project, sprint, user: userEvent.setup() }
}

describe('Board cards (spec 013)', () => {
  it('show the title, the priority and who has it, but not the description', async () => {
    const { backend, board, project } = seeded()
    const member = project.members[0]
    const task = board.tasks[0]
    Object.assign(task, { priority: 'high', assignee_id: member.id, missing_role: null, description: 'Texto que vive en el panel' })
    renderApp(`/projects/${PROJECT}/board?sprint=${task.sprint_id}`, backend)

    const card = await screen.findByRole('button', { name: `${task.key} ${task.title}` })

    expect(within(card).getByText(task.title)).toBeInTheDocument()
    expect(within(card).getByText('Alta')).toBeInTheDocument()
    expect(within(card).getByText(member.name)).toBeInTheDocument()
    expect(within(card).queryByText('Texto que vive en el panel')).not.toBeInTheDocument()
  })
})

describe('Add a task (spec 014, US1)', () => {
  it('creates one card per Enter at the end of the column and keeps the field open', async () => {
    const { backend, board, sprint, user } = seeded()
    renderApp(`/projects/${PROJECT}/board?sprint=${sprint.id}`, backend)
    const column = await screen.findByRole('region', { name: 'Por hacer' })

    await user.click(within(column).getByRole('button', { name: 'Agregar tarea' }))
    const field = within(column).getByRole('textbox', { name: 'Nueva tarea en Por hacer' })
    await user.type(field, 'Revisar textos del checkout{Enter}')
    await within(column).findByRole('button', { name: /Revisar textos del checkout/ })
    await user.type(field, 'Corregir el botón de pago{Enter}')
    await within(column).findByRole('button', { name: /Corregir el botón de pago/ })

    const added = board.tasks.filter((t) => t.title === 'Revisar textos del checkout' || t.title === 'Corregir el botón de pago')
    expect(added.map((t) => [t.status, t.sprint_id, t.priority, t.points])).toEqual([['todo', sprint.id, 'medium', 1], ['todo', sprint.id, 'medium', 1]])
    expect(new Set(added.map((t) => t.key)).size).toBe(2)
    expect(field).toHaveValue('')

    await user.keyboard('{Escape}')
    expect(within(column).queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('gives the new task the active filters and checks the title', async () => {
    const { backend, board, project, sprint, user } = seeded()
    const member = project.members[1]
    renderApp(`/projects/${PROJECT}/board?sprint=${sprint.id}&assignee=${member.id}&priority=low`, backend)
    const column = await screen.findByRole('region', { name: 'En curso' })

    await user.click(within(column).getByRole('button', { name: 'Agregar tarea' }))
    const field = within(column).getByRole('textbox', { name: 'Nueva tarea en En curso' })
    await user.click(field)
    await user.paste('x'.repeat(201))
    await user.keyboard('{Enter}')
    expect(await within(column).findByText('Entre 1 y 200 caracteres.')).toBeInTheDocument()

    await user.clear(field)
    await user.type(field, 'Ajustar el pago{Enter}')
    await within(column).findByRole('button', { name: /Ajustar el pago/ })
    const created = board.tasks.find((t) => t.title === 'Ajustar el pago')!
    expect([created.status, created.assignee_id, created.priority]).toEqual(['in_progress', member.id, 'low'])
  })

  it('is not offered on a closed sprint', async () => {
    const { backend, sprint } = seeded()
    sprint.closed = true
    renderApp(`/projects/${PROJECT}/board?sprint=${sprint.id}`, backend)
    await screen.findByRole('region', { name: 'Por hacer' })
    expect(screen.queryByRole('button', { name: 'Agregar tarea' })).not.toBeInTheDocument()
  })
})

describe('Filters behind one button (spec 014, US2)', () => {
  it('counts the filters on and clears them', async () => {
    const { backend, board, project, sprint, user } = seeded()
    const member = project.members[0]
    const sprintTasks = board.tasks.filter((t) => t.sprint_id === sprint.id)
    renderApp(`/projects/${PROJECT}/board?sprint=${sprint.id}`, backend)
    await screen.findByRole('region', { name: 'Por hacer' })

    await user.click(screen.getByRole('button', { name: 'Filtrar' }))
    const panel = screen.getByRole('dialog', { name: 'Filtrar' })
    await user.click(within(panel).getByRole('button', { name: member.name }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Alta' }))
    await user.keyboard('{Escape}')

    const button = screen.getByRole('button', { name: 'Filtrar, 2 activos' })
    expect(button).toHaveFocus()
    const shown = sprintTasks.filter((t) => t.assignee_id === member.id && t.priority === 'high')
    expect(screen.getAllByRole('button', { name: /^US-\d+ / })).toHaveLength(shown.length)

    await user.click(screen.getByRole('button', { name: 'Quitar filtros' }))
    expect(screen.getByRole('button', { name: 'Filtrar' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^US-\d+ / })).toHaveLength(sprintTasks.length)
  })
})

describe('List view (spec 014, US3)', () => {
  it('groups the tasks by column and opens one from its row', async () => {
    const { backend, board, sprint, user } = seeded()
    const task = board.tasks.find((t) => t.sprint_id === sprint.id)!
    renderApp(`/projects/${PROJECT}/board?sprint=${sprint.id}&view=list`, backend)

    expect(await screen.findByRole('radio', { name: 'Lista' })).toBeChecked()
    const statuses = new Set(board.tasks.filter((t) => t.sprint_id === sprint.id).map((t) => t.status))
    expect(screen.getAllByRole('region')).toHaveLength(statuses.size)

    await user.click(screen.getByRole('button', { name: new RegExp(task.title) }))
    expect(await screen.findByRole('dialog', { name: task.title })).toBeInTheDocument()
  })
})

describe('Team in the header (spec 014, US4)', () => {
  it('shows four sets of initials and how many more, with every name for screen readers', async () => {
    const { backend, project, sprint } = seeded()
    project.members.push(
      { id: 24, name: 'Ana Gil', role: 'QA', seniority: 'mid', hours_per_week: 20, skills: [] },
      { id: 25, name: 'Leo Ruiz', role: 'DevOps', seniority: 'mid', hours_per_week: 20, skills: [] },
      { id: 26, name: 'Eva Paz', role: 'UX', seniority: 'mid', hours_per_week: 20, skills: [] },
    )
    renderApp(`/projects/${PROJECT}/board?sprint=${sprint.id}`, backend)

    const team = await screen.findByRole('link', { name: 'Equipo: Marta Díaz, Pablo Ortiz, Sara Vidal, Ana Gil, Leo Ruiz y Eva Paz' })
    expect(within(team).getByText('+2')).toBeInTheDocument()
    expect(team).toHaveAttribute('href', `/projects/${PROJECT}/settings`)
  })
})
