// The public endpoints of spec 017. No session: the portal is open to anyone with the link.

import type { CitizenAnswer, Portal, PublicProjectCard } from '@agile/domain'
import { ApiError, type ApiErrorBody } from '../../application/errors'
import type { PublicPortalGateway } from '../../application/ports'

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, { code: 'network_error', detail: 'Can’t reach the server.' })
  }
  const data: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const error = data as Partial<ApiErrorBody> | null
    throw new ApiError(response.status, {
      code: typeof error?.code === 'string' ? error.code : 'internal_error',
      detail: typeof error?.detail === 'string' ? error.detail : 'Unexpected error.',
    })
  }
  return data as T
}

const slugPath = (slug: string) => `/public/projects/${encodeURIComponent(slug)}`

export const httpPublicPortalGateway: PublicPortalGateway = {
  searchProjects: (query) =>
    request<PublicProjectCard[]>('GET', `/public/projects${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`),
  getPortal: (slug) => request<Portal>('GET', slugPath(slug)),
  ask: (slug, question) => request<CitizenAnswer>('POST', `${slugPath(slug)}/ask`, { question }),
}
