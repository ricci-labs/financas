import type { ButtonProps } from '@web/components/actions/button'

export type SubmitButtonProps = Omit<
  ButtonProps,
  'type' | 'isDisabled' | 'isLoading' | 'onDisabledPress'
> & {
  requiresChange?: boolean
  isBlocked?: boolean
}
