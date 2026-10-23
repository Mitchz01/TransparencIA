import type { PublicPortalGateway } from '../../application/ports'
import type { CitizenAnswer, Portal } from '../../domain/transparency'
import { http } from './client'

// Spec 017, no session. Owner: P5.
export const httpPublicPortalGateway: PublicPortalGateway = {
  getPortal: (slug) => http.get<Portal>(`/public/projects/${encodeURIComponent(slug)}`),
  ask: (slug, question) => http.post<CitizenAnswer>(`/public/projects/${encodeURIComponent(slug)}/ask`, { question }),
}
