import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { createQueryClient } from '../app/App'
import { routes } from '../app/routes'
import { ThemeProvider } from '../app/theme'
import { ApiError } from '../application/errors'
import { GatewayProvider } from '../application/gateway'
import type { PublicPortalGateway } from '../application/ports'

export function notFound(): Promise<never> {
  return Promise.reject(new ApiError(404, { code: 'project_not_found', detail: 'Not found.' }))
}

/** The portal at `path`, on a gateway that finds nothing unless `overrides` says otherwise. */
export function renderPortal(path: string, overrides: Partial<PublicPortalGateway> = {}) {
  const gateway: PublicPortalGateway = { searchProjects: () => Promise.resolve([]), getPortal: notFound, ask: notFound, ...overrides }
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <QueryClientProvider client={createQueryClient()}>
      <GatewayProvider gateway={gateway}>
        <ThemeProvider>
          <RouterProvider router={router} />
        </ThemeProvider>
      </GatewayProvider>
    </QueryClientProvider>,
  )
  return router
}
