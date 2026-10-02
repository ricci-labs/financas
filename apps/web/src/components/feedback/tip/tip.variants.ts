import { cva } from 'class-variance-authority'

export const tipVariants = cva(
  'flex items-center justify-center gap-2 text-body-sm text-current [&>svg]:size-4.5 [&>svg]:shrink-0',
)
