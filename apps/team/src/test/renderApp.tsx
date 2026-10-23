// Renders the whole app at a path, on the fake backend, for flow tests.

import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { ToastProvider } from '../application/toasts'
import { createQueryClient } from '../app/App'
import { GatewaysProvider } from '../app/container'
import { routes, sessionEnded } from '../app/routes'
import { ThemeProvider } from '../app/theme'
import { createFakeBackend, FakeStore, type FakeBackend } from '../adapters/fake'
import { Toaster } from '../ui/components/shell/Toaster'

export function renderApp(path: string, backend: FakeBackend = createFakeBackend({ store: new FakeStore(), stageDelayMs: 50 })) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const client = createQueryClient()
  const view = render(
    <QueryClientProvider client={client}>
      <GatewaysProvider gateways={backend.gateways} onSignedOut={sessionEnded(router, client)}>
        <ThemeProvider>
          <ToastProvider>
            <RouterProvider router={router} />
            <Toaster />
          </ToastProvider>
        </ThemeProvider>
      </GatewaysProvider>
    </QueryClientProvider>,
  )
  return { ...view, router, backend, client }
}
