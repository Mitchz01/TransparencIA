// The API's error body (plan/api-conventions.md, "Error body").

export interface ApiErrorBody {
  code: string // switch on this, never on detail
  detail: string // safe to show
}

// Explicit fields: the app's tsconfig uses erasableSyntaxOnly (no parameter properties).
export class ApiError extends Error {
  status: number // 0 = network error
  code: string

  constructor(status: number, body: ApiErrorBody) {
    super(body.detail)
    this.name = 'ApiError'
    this.status = status
    this.code = body.code
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError
