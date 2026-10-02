import type { apiErrorBodySchema } from '@web/lib/api/api.schemas'
import type { z } from 'zod'

export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>

export type ApiResponse<Body> = {
  ok: boolean
  status: number
  headers: Headers
  json: () => Promise<Body>
}

export type ApiErrorDetails = {
  status: number
  code: string
  ref: string | null
  retryAfterSeconds: number | null
}
