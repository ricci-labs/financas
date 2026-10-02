import type { ApiErrorDetails } from '@web/lib/api/api.types'

export const UNKNOWN_ERROR_CODE = 'UNKNOWN'
export const SESSION_REQUIRED_STATUS = 401
const SERVER_ERROR_STATUS = 500

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly ref: string | null
  readonly retryAfterSeconds: number | null

  constructor({ status, code, ref, retryAfterSeconds }: ApiErrorDetails) {
    super(`API answered ${status} ${code}`)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.ref = ref
    this.retryAfterSeconds = retryAfterSeconds
  }

  get isServerError(): boolean {
    return this.status >= SERVER_ERROR_STATUS
  }
}

export class NetworkError extends Error {
  constructor(cause: unknown) {
    super('The API could not be reached', { cause })
    this.name = 'NetworkError'
  }
}

const SESSION_ENDED_CODES = new Set(['SESSION_REQUIRED', 'UNAUTHORIZED'])

export function isSessionRequired(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === SESSION_REQUIRED_STATUS &&
    SESSION_ENDED_CODES.has(error.code)
  )
}

const PERMISSION_DENIED_STATUS = 403
const PERMISSION_DENIED_CODES = new Set(['PERMISSION_DENIED', 'FORBIDDEN'])

export function isPermissionDenied(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === PERMISSION_DENIED_STATUS &&
    PERMISSION_DENIED_CODES.has(error.code)
  )
}

export function isRetryable(error: unknown): boolean {
  return error instanceof NetworkError || (error instanceof ApiError && error.isServerError)
}
