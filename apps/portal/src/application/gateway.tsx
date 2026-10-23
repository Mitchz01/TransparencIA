import { createContext, use, type ReactNode } from 'react'
import type { PublicPortalGateway } from './ports'

const GatewayContext = createContext<PublicPortalGateway | null>(null)

export function GatewayProvider({ gateway, children }: { gateway: PublicPortalGateway; children: ReactNode }) {
  return <GatewayContext value={gateway}>{children}</GatewayContext>
}

export function useGateway(): PublicPortalGateway {
  const gateway = use(GatewayContext)
  if (!gateway) throw new Error('useGateway needs a GatewayProvider')
  return gateway
}
