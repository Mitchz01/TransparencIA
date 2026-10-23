import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createFakeBackend, FakeStore } from '../../adapters/fake'
import { buildPlanViews } from '../../adapters/fake/planViews'
import { renderApp } from '../../test/renderApp'

describe('Plan', () => {
  it('shows a part that waits for approval with a link to the proposal, never its content', async () => {
    const backend = createFakeBackend({ store: new FakeStore(), stageDelayMs: 10 })
    const project = backend.store.projects.get(1)!
    const { architecture: _, ...plan } = project.plan!
    backend.store.projects.set(1, { ...project, plan })
    const approved = [...backend.store.proposals.values()].find((p) => p.project_id === 1 && p.key === 'architecture')!
    backend.store.proposals.set(approved.id, { ...approved, status: 'pending', resolved_at: null })

    renderApp('/projects/1/plan?view=architecture', backend)

    expect(await screen.findByRole('heading', { name: 'Espera tu aprobación' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver la propuesta' })).toHaveAttribute('href', '/projects/1/planning')
    expect(screen.queryByText('Monolito modular')).not.toBeInTheDocument()
  })

  it('shows each approved part with where it came from', async () => {
    renderApp('/projects/2/plan?view=methodology')
    const view = await screen.findByRole('article')
    expect(within(view).getByRole('heading', { name: 'Scrumban, iteraciones de 2 semanas' })).toBeInTheDocument()
    expect(screen.getByText('Elegida por los agentes')).toBeInTheDocument()
    expect(screen.getByText('Asesor de planeación')).toBeInTheDocument()
    expect(screen.getByText('Aprobado por ti')).toBeInTheDocument()
  })
})

describe('fake plan views', () => {
  it('marks the current week and its phase, three weeks after the sprints were approved', () => {
    const store = new FakeStore()
    const views = buildPlanViews(
      store.projects.get(2)!,
      [...store.proposals.values()].filter((p) => p.project_id === 2),
      store.boards.get(2)!.tasks,
      new Date('2026-10-26T12:00:00Z'), // the sprints were approved on Oct 9
    )
    expect(views.roadmap.content).toMatchObject({ current_week: 3, current_phase: 'MVP', overdue: false })
    expect(views.roadmap.content!.progress.points_done).toBe(2)
    expect(views.roadmap.content!.phases[0].epics[0].has_tasks).toBe(true)
  })
})

describe('Visual plan views (spec 012)', () => {
  afterEach(() => vi.useRealTimers())

  it('draws the roadmap as bars over the weeks, with today and the milestones', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-26T12:00:00Z')) // week 3: the sprints were approved on Oct 9
    renderApp('/projects/2/plan?view=roadmap')

    expect(await screen.findByRole('progressbar', { name: /^Bases, semanas 1 a 2, / })).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: /^MVP, semanas 3 a 4, / })).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: /^EP-1 Puesta en marcha: / })).toBeInTheDocument()
    expect(screen.getByText(', semana actual').parentElement).toHaveTextContent(/^3/)
    expect(screen.getByText('Semana 2, fin de Bases')).toBeInTheDocument()
    expect(screen.getByText('Repo y CI, Proyecto y equipo')).toBeInTheDocument()
  })

  it('draws the methodology as the iteration and the board flows', async () => {
    renderApp('/projects/2/plan?view=methodology')

    const ceremonies = within(await screen.findByRole('list', { name: 'Ceremonias en orden' })).getAllByRole('listitem')
    expect(ceremonies.map((li) => li.textContent)).toEqual([
      expect.stringMatching(/^Planning/),
      expect.stringMatching(/^Daily/),
      expect.stringMatching(/^Retro/),
      'Se repite cada 2 semanas',
    ])
    const board = within(screen.getByRole('list', { name: 'Columnas del tablero con su límite' }))
    expect(board.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Por hacerSin límite',
      'En ejecuciónMáximo 3 a la vez',
      'En verificaciónMáximo 2 a la vez',
      'TerminadaSin límite',
    ])
  })

  it('draws the architecture as layers with their components, and folds the decisions', async () => {
    renderApp('/projects/2/plan?view=architecture')

    expect(within(await screen.findByRole('region', { name: 'Frontend' })).getByText('App web')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Backend' })).getByText('API')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'IA' })).getByText('Agentes')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Otras piezas' })).getByText('Base de datos')).toBeInTheDocument()

    const decision = screen.getByText('Salidas estructuradas').closest('details')!
    expect(decision).not.toHaveAttribute('open')
    await userEvent.click(screen.getByText('Salidas estructuradas'))
    expect(decision).toHaveAttribute('open')
  })
})
