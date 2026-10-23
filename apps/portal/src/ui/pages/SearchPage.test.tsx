import type { PublicProjectCard } from '@agile/domain'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { PublicPortalGateway } from '../../application/ports'
import { renderPortal } from '../../test/renderPortal'

const card = (overrides: Partial<PublicProjectCard>): PublicProjectCard => ({
  slug: 'demo', name: 'Restauración de manglar en la Ciénaga Grande', description: 'Manglar.',
  contracting_entity: 'Corpamag', contractor: 'Fundación Manglares Vivos', contract_value: 180_000_000,
  start_date: '2026-08-03', end_date: '2027-02-01', light: 'yellow', spent_pct: 18, physical_pct: 22.2, time_pct: 44.5, open_alerts: 1,
  ...overrides,
})
const CARDS = [card({}), card({ slug: 'via', name: 'Vía terciaria en Aracataca', light: 'red', open_alerts: 0 })]

const renderHome = (searchProjects: PublicPortalGateway['searchProjects'], path = '/') => renderPortal(path, { searchProjects })

describe('SearchPage', () => {
  it('previews the published project with the most open alerts in the hero', async () => {
    renderHome(() => Promise.resolve(CARDS))
    expect(await screen.findByRole('link', { name: 'Ver el proyecto Restauración de manglar en la Ciénaga Grande' })).toHaveAttribute('href', '/p/demo')
  })

  it('searches a suggested word', async () => {
    const search = vi.fn((query: string) => Promise.resolve(query ? [CARDS[1]] : CARDS))
    renderHome(search)
    await userEvent.click(await screen.findByRole('button', { name: 'acueducto' }))
    expect(search).toHaveBeenLastCalledWith('acueducto')
  })

  it('lists the published projects with their state, money and work', async () => {
    renderHome(() => Promise.resolve(CARDS))
    const link = await screen.findByRole('link', { name: /^En amarillo.*Restauración de manglar/ })
    expect(await screen.findByText(/2 proyectos por \$ 360 millones en contratos, con 1 alerta en revisión/)).toBeVisible()
    expect(link).toHaveAttribute('href', '/p/demo')
    expect(link).toHaveTextContent('En amarillo')
    expect(link).toHaveTextContent('1 alerta en revisión')
    expect(link).toHaveTextContent('Fundación Manglares Vivos para Corpamag')
    expect(screen.getByText('2 proyectos públicos')).toBeVisible()
  })

  it('searches what is typed and keeps it in the address', async () => {
    const search = vi.fn((query: string) => Promise.resolve(query ? [CARDS[1]] : CARDS))
    const router = renderHome(search)
    await userEvent.type(await screen.findByRole('searchbox', { name: 'Buscar proyectos' }), 'aracataca')
    expect(await screen.findByText('1 proyecto público')).toBeVisible()
    expect(search).toHaveBeenLastCalledWith('aracataca')
    expect(router.state.location.search).toBe('?q=aracataca')
  })

  it('filters by traffic light', async () => {
    renderHome(() => Promise.resolve(CARDS))
    await userEvent.click(await screen.findByRole('button', { name: 'En rojo (1)' }))
    expect(screen.getByRole('link', { name: /^En rojo.*Vía terciaria/ })).toBeVisible()
    expect(screen.queryByRole('link', { name: /^En amarillo.*Restauración de manglar/ })).toBeNull()
  })

  it('says when nothing matches and lets you see them all again', async () => {
    renderHome((query) => Promise.resolve(query ? [] : CARDS), '/?q=puente')
    expect(await screen.findByText('Ningún proyecto público coincide')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Ver todos los proyectos' }))
    expect(await screen.findByText('2 proyectos públicos')).toBeVisible()
  })
})

describe('PortalLayout', () => {
  it('navigates to how it works and sends the executing entity to the team app', async () => {
    renderPortal('/')
    const nav = screen.getAllByRole('navigation', { name: 'Principal' })[0]
    expect(screen.getAllByRole('link', { name: 'Soy ejecutor' })[0]).toHaveAttribute('href', 'http://localhost:5173/login')
    await userEvent.click(within(nav).getByRole('link', { name: 'Cómo funciona' }))
    expect(await screen.findByRole('heading', { name: 'Cómo funciona', level: 1 })).toBeVisible()
  })
})
