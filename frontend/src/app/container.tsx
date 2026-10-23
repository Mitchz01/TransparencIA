// Composition root of the frontend: the only module that imports adapters/.
// VITE_USE_FAKE=true runs the whole app on the in-memory backend with fake agents (spec 009, FR-007).

import type { ReactNode } from 'react'
import { GatewaysContext } from '../application/gateways'
import type { Gateways } from '../application/ports'
import { createFakeBackend, setFakeOffline } from '../adapters/fake'
import { createHttpGateways } from '../adapters/http'

export const usesFakeBackend = import.meta.env.VITE_USE_FAKE === 'true'

function browserStorage(): Storage | undefined {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

function createGateways(): Gateways {
  if (!usesFakeBackend) return createHttpGateways()
  const backend = createFakeBackend({ storage: browserStorage() })
  // Handles for trying the demo by hand from the browser console.
  Object.assign(window, {
    fakeBackend: {
      ...backend,
      setOffline: setFakeOffline,
      reset: () => {
        backend.forget()
        window.location.assign('/')
      },
    },
  })
  return backend.gateways
}

let shared: Gateways | null = null

export function GatewaysProvider({ children, gateways }: { children: ReactNode; gateways?: Gateways }) {
  shared ??= gateways ?? createGateways()
  return <GatewaysContext.Provider value={gateways ?? shared}>{children}</GatewaysContext.Provider>
}
