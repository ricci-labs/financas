import { ApiError, NetworkError } from '@web/lib/api/api-error'
import {
  errorMessages,
  NETWORK_ERROR_MESSAGE,
  UNKNOWN_ERROR_MESSAGE,
} from '@web/lib/errors/errors.messages'
import type { MessageValues } from '@web/lib/errors/errors.types'
import { fill } from '@web/lib/format/template'

const INTERNAL_ERROR_CODE = 'INTERNAL_ERROR'
const SECONDS_PER_MINUTE = 60
const MISSING_REF = '—'

export function errorMessageFor(error: unknown, values: MessageValues = {}): string {
  if (error instanceof NetworkError) {
    return NETWORK_ERROR_MESSAGE
  }
  if (!(error instanceof ApiError)) {
    return fill(UNKNOWN_ERROR_MESSAGE, { ref: MISSING_REF })
  }
  return fill(templateFor(error), { ...valuesOf(error), ...values })
}

function templateFor(error: ApiError): string {
  const known = errorMessages[error.code]
  if (known) {
    return known
  }
  return error.isServerError
    ? (errorMessages[INTERNAL_ERROR_CODE] ?? UNKNOWN_ERROR_MESSAGE)
    : UNKNOWN_ERROR_MESSAGE
}

export function retryMinutesOf(error: ApiError): number | null {
  return error.retryAfterSeconds === null
    ? null
    : Math.ceil(error.retryAfterSeconds / SECONDS_PER_MINUTE)
}

function valuesOf(error: ApiError): MessageValues {
  const minutes = retryMinutesOf(error)
  return {
    ref: error.ref ?? MISSING_REF,
    ...(minutes === null ? {} : { minutos: minutes }),
  }
}
