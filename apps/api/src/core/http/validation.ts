import { parseOrThrow } from '@api/core/http/errors'
import { validator } from 'hono/validator'
import type { z } from 'zod'

export function jsonBody<T>(schema: z.ZodType<T>, invalidCode: string) {
  return validator('json', (value) => parseOrThrow(schema, value, invalidCode))
}
