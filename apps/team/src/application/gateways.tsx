// The gateways the hooks use. app/container.tsx decides which adapters fill it (http or fake).

import { createContext, useContext } from 'react'
import type { Gateways } from './ports'

export const GatewaysContext = createContext<Gateways | null>(null)

export function useGateways(): Gateways {
  const gateways = useContext(GatewaysContext)
  if (!gateways) throw new Error('useGateways needs a GatewaysProvider (app/container.tsx)')
  return gateways
}
