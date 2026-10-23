// Spec 017's public portal without a backend: the @agile/domain/fixtures portal minus drafts, 404 for "no-existe". Owner: P5.

import type { PublicPortalGateway } from '../../application/ports'

const todo = (): never => {
  throw new Error('fakePublicPortalGateway: not written yet (P5)')
}

export function fakePublicPortalGateway(): PublicPortalGateway {
  return {
    getPortal: async () => todo(),
    ask: async () => todo(),
  }
}
