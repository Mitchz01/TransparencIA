// The API's error body (plan/api-conventions.md, "Error body"). It lives in application/
// so pages and hooks can recognize it without importing adapters/.

export interface FieldError {
  field: string // path into the request body: "name", "members[1].hours_per_week", "" = whole body
  message: string // safe to show
}

export interface ApiErrorBody {
  code: string // switch on this, never on detail
  detail: string // safe to show
  errors?: FieldError[] // only on 422
  [extra: string]: unknown // some codes add context (status, reason, proposal_id, current_version)
}

// Explicit fields: the app's tsconfig uses erasableSyntaxOnly (no parameter properties).
export class ApiError extends Error {
  status: number // 0 = network error
  body: ApiErrorBody
  requestId: string

  constructor(status: number, body: ApiErrorBody, requestId: string) {
    super(body.detail)
    this.name = 'ApiError'
    this.status = status
    this.body = body
    this.requestId = requestId
  }

  get code(): string {
    return this.body.code
  }

  /** 422 field errors keyed by path, ready to show under each form input. */
  fieldErrors(): Record<string, string> {
    return Object.fromEntries((this.body.errors ?? []).map((e) => [e.field, e.message]))
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError

export const hasCode = (error: unknown, code: string): boolean => isApiError(error) && error.code === code
