import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { RouterProvider } from 'react-router-dom'
import { httpPublicPortalGateway } from '../adapters/http/publicPortalGateway'
import { GatewayProvider } from '../application/gateway'
import { isApiError } from '../application/errors'
import { createRouter } from './routes'

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
      <GatewayProvider gateway={httpPublicPortalGateway}>
        <RouterProvider router={router} />
      </GatewayProvider>
    </QueryClientProvider>
  )
}
