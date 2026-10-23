import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { RouterProvider } from 'react-router-dom'
import { isApiError } from '../application/errors'
import { ToastProvider } from '../application/toasts'
import { Toaster } from '../ui/components/ds'
import { GatewaysProvider } from './container'
import { createRouter, sessionEnded } from './routes'
import { ThemeProvider } from './theme'

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false, // the event stream says when something changed
        retry: (count, error) => !(isApiError(error) && error.status >= 400 && error.status < 500) && count < 2,
      },
      mutations: { retry: false },
    },
  })
}

export default function App() {
  const [queryClient] = useState(createQueryClient)
  const [router] = useState(createRouter)
  const onSignedOut = useMemo(() => sessionEnded(router, queryClient), [router, queryClient])
  return (
    <QueryClientProvider client={queryClient}>
      <GatewaysProvider onSignedOut={onSignedOut}>
        <ThemeProvider>
          <ToastProvider>
            <RouterProvider router={router} />
            <Toaster />
          </ToastProvider>
        </ThemeProvider>
      </GatewaysProvider>
    </QueryClientProvider>
  )
}
