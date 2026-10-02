import type { ReactNode } from 'react'
import type { FieldValues, SubmitHandler, UseFormReturn } from 'react-hook-form'

export type FormProps<Input extends FieldValues, Output extends FieldValues> = {
  form: UseFormReturn<Input, unknown, Output>
  onSubmit: SubmitHandler<Output>
  children: ReactNode
  className?: string
}
