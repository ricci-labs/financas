import type { AlertProps, AlertTone } from '@web/components/feedback/alert/alert.types'
import { alertBodyVariants, alertVariants } from '@web/components/feedback/alert/alert.variants'
import { cn } from '@web/lib/cn'
import { CircleAlert, CircleCheck, Info, type LucideIcon, TriangleAlert } from 'lucide-react'

const TONE_ICONS: Record<AlertTone, LucideIcon> = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleAlert,
}

export function Alert({ tone, isUrgent = false, action, children, className }: AlertProps) {
  const Icon = TONE_ICONS[tone]
  return (
    <div
      data-slot="alert"
      role={isUrgent ? 'alert' : 'status'}
      className={cn(alertVariants({ tone }), className)}
    >
      <Icon aria-hidden="true" />
      <div className={alertBodyVariants()}>
        <p>{children}</p>
        {action}
      </div>
    </div>
  )
}
