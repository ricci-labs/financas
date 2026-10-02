import { cva } from 'class-variance-authority'

export const nextStepCardVariants = cva([
  'flex items-start gap-2.5 rounded-md bg-mint-soft px-4 py-3 text-left text-body-sm text-ink',
  'outline-2 -outline-offset-2 outline-ink outline-dashed [&>svg]:mt-px [&>svg]:size-4.5 [&>svg]:shrink-0',
])
