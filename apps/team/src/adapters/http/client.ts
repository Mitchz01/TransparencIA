// Calling rules of apps/team/docs/api-contract.md, section 1: base path /api, JSON bodies,
// an X-Request-Id per request, and every error turned into an ApiError.

import { ApiError, type ApiErrorBody } from '../../application/errors'

const BASE = '/api'

export type Query = Record<string, string | number | undefined>

function url(path: string, query?: Query): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) params.set(key, String(value))
  }
  const search = params.toString()
  return `${BASE}${path}${search ? `?${search}` : ''}`
}

export async function request<T>(method: string, path: string, options: { body?: unknown; query?: Query } = {}): Promise<T> {
  const requestId = crypto.randomUUID()
  const headers: Record<string, string> = { 'X-Request-Id': requestId, Accept: 'application/json' }
  // FormData (spec 017's uploads) sets its own multipart Content-Type with the boundary.
  const isForm = options.body instanceof FormData
  if (options.body !== undefined && !isForm) headers['Content-Type'] = 'application/json'

  let response: Response
  try {
    response = await fetch(url(path, options.query), {
      method,
      headers,
      body: options.body === undefined ? undefined : isForm ? (options.body as FormData) : JSON.stringify(options.body),
    })
  } catch {
    throw new ApiError(0, { code: 'network_error', detail: 'Can’t reach the server.' }, requestId)
  }

  const echoedId = response.headers.get('X-Request-Id') ?? requestId
  if (response.status === 204) return undefined as T
  const data: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const body = isErrorBody(data) ? data : { code: 'internal_error', detail: 'Unexpected error.' }
    throw new ApiError(response.status, body, echoedId)
  }
  return data as T
}

function isErrorBody(data: unknown): data is ApiErrorBody {
  return typeof data === 'object' && data !== null && typeof (data as ApiErrorBody).code === 'string'
}

export const http = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body }),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, { body }),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, { body }),
  delete: <T>(path: string) => request<T>('DELETE', path),
  /** multipart/form-data with the file in field `file` (spec 017, D3). */
  upload: <T>(path: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<T>('POST', path, { body: form })
  },
}

export const apiUrl = url
