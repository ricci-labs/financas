import type { alertVariants } from '@web/components/feedback/alert/alert.variants'
import type { VariantProps } from 'class-variance-authority'
import type { ReactNode } from 'react'

export type AlertTone = NonNullable<VariantProps<typeof alertVariants>['tone']>

export type AlertProps = {
  tone: AlertTone
  isUrgent?: boolean
  action?: ReactNode
  children: ReactNode
  className?: string
}
