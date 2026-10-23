// The portal's port: the UI depends on this interface, not on fetch.
// Endpoints: specs/017-transparency-portal/plan.md, "GET /api/public/projects/{slug}" and ".../ask".
// Every method rejects with an ApiError (application/errors.ts) on failure.

import type { CitizenAnswer, Portal, PublicProjectCard } from '@agile/domain'

export interface PublicPortalGateway {
  /** The published projects matching the words of `query` (spec 017, US8); all of them when it's empty. */
  searchProjects(query: string): Promise<PublicProjectCard[]>
  getPortal(slug: string): Promise<Portal>
  ask(slug: string, question: string): Promise<CitizenAnswer>
}
