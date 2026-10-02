import { zodResolver } from '@hookform/resolvers/zod'
import { fieldErrorMap } from '@web/lib/forms/field-errors'
import type { SchemaFormOptions } from '@web/lib/forms/forms.types'
import { type FieldValues, useForm } from 'react-hook-form'
import type { z } from 'zod'

const VALIDATE_ON_FIRST_BLUR_THEN_EVERY_CHANGE = 'onTouched'

export function useSchemaForm<Schema extends z.ZodType<FieldValues, FieldValues>>({
  schema,
  requiredMessages,
  defaultValues,
}: SchemaFormOptions<Schema>) {
  return useForm<z.input<Schema>, unknown, z.output<Schema>>({
    resolver: zodResolver(schema, { error: fieldErrorMap(requiredMessages) }),
    mode: VALIDATE_ON_FIRST_BLUR_THEN_EVERY_CHANGE,
    defaultValues,
  })
}
