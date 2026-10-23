// Composition root of the frontend: the only module that imports adapters/.
// VITE_USE_FAKE=true runs the whole app on the in-memory backend with fake agents (spec 009, FR-007).

import { useMemo, type ReactNode } from 'react'
import { GatewaysContext } from '../application/gateways'
import type { Gateways } from '../application/ports'
import { watchSession } from '../application/session'
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
      // fakeBackend.signInAs('Leo') shows the member view; the demo password is in adapters/fake/demoData.ts.
      signInAs: (name: string) => {
        backend.signInAs(name)
        window.location.assign('/')
      },
    },
  })
  return backend.gateways
}

let shared: Gateways | null = null

interface GatewaysProviderProps {
  children: ReactNode
  gateways?: Gateways
  /** Called when any call answers 401 not_authenticated (spec 015): the session ended. */
  onSignedOut?: () => void
}

export function GatewaysProvider({ children, gateways, onSignedOut }: GatewaysProviderProps) {
  shared ??= gateways ?? createGateways()
  const base = gateways ?? shared
  const value = useMemo(() => (onSignedOut ? watchSession(base, onSignedOut) : base), [base, onSignedOut])
  return <GatewaysContext.Provider value={value}>{children}</GatewaysContext.Provider>
}
