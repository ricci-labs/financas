import type { z } from 'zod'

export class AppError extends Error {
  readonly code: string

  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = new.target.name
    this.code = code
  }
}

export class ValidationError extends AppError {}

export class UnauthorizedError extends AppError {}

export class ForbiddenError extends AppError {}

export class NotFoundError extends AppError {}

export class ConflictError extends AppError {}

export class TooManyRequestsError extends AppError {}

export function parseOrThrow<T>(schema: z.ZodType<T>, rawInput: unknown, invalidCode: string): T {
  const parsed = schema.safeParse(rawInput)
  if (!parsed.success) {
    const [issue] = parsed.error.issues
    const field = issue?.path.join('.') || 'input'
    throw new ValidationError(invalidCode, `${field}: ${issue?.message ?? 'invalid'}`)
  }
  return parsed.data
}
