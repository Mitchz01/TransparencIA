import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { samplePortal } from '../../adapters/fake/samplePortal'
import { createQueryClient } from '../../app/App'
import { routes } from '../../app/routes'
import { ApiError } from '../../application/errors'
import { GatewayProvider } from '../../application/gateway'
import type { PublicPortalGateway } from '../../application/ports'

const portal = samplePortal()

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
const unavailable = () => Promise.reject(new ApiError(502, { code: 'agent_unavailable', detail: 'Agent failed.' }))

describe('PublicPortalPage', () => {
  it('shows the published project with its traffic light, budget lines and evidence', async () => {
    renderAt('/p/Xk3', { getPortal: () => Promise.resolve(portal), ask: notFound })
    expect(await screen.findByRole('heading', { name: portal.project.name })).toBeVisible()
    expect(screen.getByText(/Fundación Manglares Vivos ejecuta para Corpamag/)).toBeVisible()
    expect(screen.getByText('En amarillo')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Rubros del presupuesto' })).toBeVisible()
    expect(screen.getByText(portal.expenses[2].citizen_summary)).toBeVisible()
    expect(screen.getByText(/Ley 1712 de 2014/)).toBeVisible()
  })

  it('answers a suggested question in the chat', async () => {
    renderAt('/p/Xk3', { getPortal: () => Promise.resolve(portal), ask: () => Promise.resolve({ answer: 'En plántulas de mangle.' }) })
    await userEvent.click(await screen.findByRole('button', { name: '¿En qué se gastaron la plata?' }))
    expect(await screen.findByText('En plántulas de mangle.')).toBeVisible()
  })

  it('says the assistant is down while the data stays', async () => {
    renderAt('/p/Xk3', { getPortal: () => Promise.resolve(portal), ask: unavailable })
    await userEvent.click(await screen.findByRole('button', { name: '¿Cuánto falta por ejecutar?' }))
    expect(await screen.findByText(/El asistente no está disponible/)).toBeVisible()
    expect(screen.getByText('En amarillo')).toBeVisible()
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
