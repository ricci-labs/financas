import type { FormProblem } from '@web/features/auth/auth.types'
import { ApiError } from '@web/lib/api/api-error'
import { errorMessageFor } from '@web/lib/errors/error-message'

const MS_PER_SECOND = 1000

export function formProblemOf(error: unknown): FormProblem {
  const message = errorMessageFor(error)
  if (error instanceof ApiError && error.code === 'TOO_MANY_ATTEMPTS') {
    return {
      kind: 'limited',
      message,
      retryAt: Date.now() + (error.retryAfterSeconds ?? 0) * MS_PER_SECOND,
    }
  }
  return { kind: 'unexpected', message }
}
