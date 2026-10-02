import type { ReactNode, Ref } from 'react'
import type { FieldPath, FieldValues } from 'react-hook-form'

export type FieldControlProps = {
  id: string
  name: string
  value: string
  ref: Ref<HTMLInputElement>
  onChange: (event: { target: { value: string } }) => void
  onBlur: () => void
  readOnly: boolean
  required: boolean
  maxLength?: number
  'aria-invalid'?: true
  'aria-describedby'?: string
}

export type FormFieldProps<Values extends FieldValues> = {
  name: FieldPath<Values>
  label: string
  help?: string
  isRequired?: boolean
  isReadOnly?: boolean
  maxLength?: number
  children: (control: FieldControlProps) => ReactNode
}

export type FieldLabelProps = {
  htmlFor: string
  label: string
  isRequired: boolean
}

export type FieldErrorProps = {
  id: string
  message: string | undefined
}
