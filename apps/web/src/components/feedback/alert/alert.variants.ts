import { cva } from 'class-variance-authority'

export const alertVariants = cva(
  'flex gap-3 rounded-md px-4 py-3 text-body-sm text-ink [&>svg]:mt-px [&>svg]:size-4.5 [&>svg]:shrink-0',
  {
    variants: {
      tone: {
        info: 'bg-info-soft [&>svg]:text-info',
        success: 'bg-success-soft [&>svg]:text-success',
        warning: 'bg-warning-soft [&>svg]:text-warning',
        danger: 'bg-danger-soft [&>svg]:text-danger',
      },
    },
    defaultVariants: { tone: 'info' },
  },
)

export const alertBodyVariants = cva('flex flex-col items-start gap-2')
