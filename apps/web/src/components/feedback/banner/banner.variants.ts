import { cva } from 'class-variance-authority'

export const bannerVariants = cva(
  'flex items-center gap-3 bg-ink px-4 py-3 text-label text-surface [&>svg]:size-4.5 [&>svg]:shrink-0',
)
