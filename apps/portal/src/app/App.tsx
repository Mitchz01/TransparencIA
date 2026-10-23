import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { RouterProvider } from 'react-router-dom'
import { fakePublicPortalGateway } from '../adapters/fake/publicPortalGateway'
import { httpPublicPortalGateway } from '../adapters/http/publicPortalGateway'
import { GatewayProvider } from '../application/gateway'
import { isApiError } from '../application/errors'
import { createRouter } from './routes'

// VITE_USE_FAKE=true runs the portal on the demo project, without a backend (spec 017, D14).
const gateway = import.meta.env.VITE_USE_FAKE === 'true' ? fakePublicPortalGateway() : httpPublicPortalGateway

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        retry: (count, error) => !(isApiError(error) && error.status >= 400 && error.status < 500) && count < 2,
      },
      mutations: { retry: false },
    },
  })
}

export default function App() {
  const [queryClient] = useState(createQueryClient)
  const [router] = useState(createRouter)
  return (
    <QueryClientProvider client={queryClient}>
      <GatewayProvider gateway={gateway}>
        <RouterProvider router={router} />
      </GatewayProvider>
    </QueryClientProvider>
  )
}
