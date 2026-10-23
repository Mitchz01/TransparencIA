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
    expect(screen.queryByText('Ejecución directa con la comunidad')).not.toBeInTheDocument()
  })

  it('shows each approved part with where it came from', async () => {
    renderApp('/projects/2/plan?view=methodology')
    const view = await screen.findByRole('article')
    expect(within(view).getByRole('heading', { name: 'Por etapas de 2 semanas' })).toBeInTheDocument()
    expect(screen.getByText('Trabajo por etapas')).toBeInTheDocument()
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
    expect(views.roadmap.content).toMatchObject({ current_week: 3, current_phase: 'Vivero y siembra', overdue: false })
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

    expect(await screen.findByRole('progressbar', { name: /^Diagnóstico, semanas 1 a 2, / })).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: /^Vivero y siembra, semanas 3 a 4, / })).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: /^C-1 Diagnóstico del sitio: / })).toBeInTheDocument()
    expect(screen.getByText(', semana actual').parentElement).toHaveTextContent(/^3/)
    expect(screen.getByText('Semana 2, fin de Diagnóstico')).toBeInTheDocument()
    expect(screen.getByText('Informe de diagnóstico, Acta de socialización')).toBeInTheDocument()
  })

  it('draws the methodology as the iteration and the board flows', async () => {
    renderApp('/projects/2/plan?view=methodology')

    const meetings = within(await screen.findByRole('list', { name: 'Reuniones de seguimiento en orden' })).getAllByRole('listitem')
    expect(meetings.map((li) => li.textContent)).toEqual(expect.arrayContaining([
      expect.stringMatching(/^Comité de seguimiento/),
      expect.stringMatching(/^Visita de campo/),
      expect.stringMatching(/^Informe de avance/),
      'Se repite cada 2 semanas',
    ]))
    const board = within(screen.getByRole('list', { name: 'Columnas de las actividades con su límite' }))
    expect(board.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Por hacerSin límite',
      'En ejecuciónSin límite',
      'En verificaciónSin límite',
      'TerminadaSin límite',
    ])
  })

  it('draws the architecture as layers with their components, and folds the decisions', async () => {
    renderApp('/projects/2/plan?view=architecture')

    expect(within(await screen.findByRole('region', { name: 'Material vegetal' })).getByText('Vivero comunitario')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Personal' })).getByText('Siembra')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Seguimiento' })).getByText('Monitoreo')).toBeInTheDocument()

    const decision = screen.getByText('Siembra por lotes').closest('details')!
    expect(decision).not.toHaveAttribute('open')
    await userEvent.click(screen.getByText('Siembra por lotes'))
    expect(decision).toHaveAttribute('open')
  })
})
