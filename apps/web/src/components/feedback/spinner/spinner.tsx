import type { SpinnerProps } from '@web/components/feedback/spinner/spinner.types'
import { spinnerVariants } from '@web/components/feedback/spinner/spinner.variants'

export function Spinner({ size }: SpinnerProps) {
  return <span data-slot="spinner" aria-hidden="true" className={spinnerVariants({ size })} />
}
