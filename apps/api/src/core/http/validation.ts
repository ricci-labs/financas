import { NotFoundError, parseOrThrow } from '@api/core/http/errors'
import { validator } from 'hono/validator'
import type { z } from 'zod'

export function jsonBody<T>(schema: z.ZodType<T>, invalidCode: string) {
  return validator('json', (value) => parseOrThrow(schema, value, invalidCode))
}

export function pathParams<T>(schema: z.ZodType<T>, notFoundCode: string) {
  return validator('param', (value) => {
    const parsed = schema.safeParse(value)
    if (!parsed.success) {
      throw new NotFoundError(notFoundCode, 'Nothing matches this address')
    }
    return parsed.data
  })
}

export function queryParams<T>(schema: z.ZodType<T>, invalidCode: string) {
  return validator('query', (value) => parseOrThrow(schema, value, invalidCode))
}
