import type { DefaultValues, FieldValues } from 'react-hook-form'
import type { z } from 'zod'

export type RequiredMessages = Readonly<Record<string, string>>

export type FieldIssue = {
  code: string
  path?: readonly PropertyKey[]
  input?: unknown
  minimum?: unknown
  maximum?: unknown
  format?: string
}

export type SchemaFormOptions<Schema extends z.ZodType<FieldValues, FieldValues>> = {
  schema: Schema
  requiredMessages: RequiredMessages
  defaultValues: DefaultValues<z.input<Schema>>
}
