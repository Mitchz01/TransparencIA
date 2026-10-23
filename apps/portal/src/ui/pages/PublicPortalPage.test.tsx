import type { Portal } from '@agile/domain'
import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { createQueryClient } from '../../app/App'
import { routes } from '../../app/routes'
import { ApiError } from '../../application/errors'
import { GatewayProvider } from '../../application/gateway'
import type { PublicPortalGateway } from '../../application/ports'

const portal = {
  project: {
    name: 'Restauración de manglar en la Ciénaga Grande',
    description: 'Restauración de 5 ha de manglar.',
    contracting_entity: 'Corpamag',
    contractor: 'Fundación Manglares Vivos',
    contract_value: 180000000,
    start_date: '2026-08-03',
    end_date: '2027-02-01',
  },
} as Portal

function renderAt(path: string, gateway: PublicPortalGateway) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <QueryClientProvider client={createQueryClient()}>
      <GatewayProvider gateway={gateway}>
        <RouterProvider router={router} />
      </GatewayProvider>
    </QueryClientProvider>,
  )
}

const notFound = () => Promise.reject(new ApiError(404, { code: 'project_not_found', detail: 'Not found.' }))

describe('PublicPortalPage', () => {
  it('shows the published project', async () => {
    renderAt('/p/Xk3', { getPortal: () => Promise.resolve(portal), ask: notFound })
    expect(await screen.findByRole('heading', { name: portal.project.name })).toBeVisible()
    expect(screen.getByText(/Fundación Manglares Vivos ejecuta para Corpamag/)).toBeVisible()
  })

  it('says the project isn’t public when the link is unknown or unpublished', async () => {
    renderAt('/p/nope', { getPortal: notFound, ask: notFound })
    expect(await screen.findByText('Este proyecto no existe o no es público')).toBeVisible()
  })

  it('never asks to sign in: any other path is not a portal', async () => {
    renderAt('/', { getPortal: notFound, ask: notFound })
    expect(await screen.findByText('Este proyecto no existe o no es público')).toBeVisible()
  })
})
