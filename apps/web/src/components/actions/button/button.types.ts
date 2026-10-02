import type { buttonVariants } from '@web/components/actions/button/button.variants'
import type { VariantProps } from 'class-variance-authority'
import type { ComponentProps, ReactElement } from 'react'

export type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    render?: ReactElement
    isDisabled?: boolean
    onDisabledPress?: () => void
    isLoading?: boolean
    loadingLabel?: string
    waitUntil?: number | null
    waitLabel?: (secondsLeft: number) => string
  }

export type ButtonContentProps = Pick<ButtonProps, 'children' | 'loadingLabel' | 'waitLabel'> & {
  isLoading: boolean
  isWaiting: boolean
  secondsLeft: number
}
