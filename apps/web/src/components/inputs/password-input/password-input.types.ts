import type { TextInputProps } from '@web/components/inputs/text-input'

export type PasswordInputProps = Omit<TextInputProps, 'type' | 'endAdornment'>
