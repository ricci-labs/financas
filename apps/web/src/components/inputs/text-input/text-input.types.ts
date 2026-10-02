import type { ComponentProps, ReactNode } from 'react'

export type TextInputProps = ComponentProps<'input'> & {
  endAdornment?: ReactNode
}
