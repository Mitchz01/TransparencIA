import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
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
    expect(screen.getByText('Coach ágil')).toBeInTheDocument()
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
