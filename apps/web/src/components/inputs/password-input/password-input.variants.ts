import { cva } from 'class-variance-authority'

export const passwordToggleVariants = cva([
  '-mr-2 inline-flex min-h-touch shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-2',
  'text-label text-ink-muted hover:text-ink [&_svg]:size-4.5',
])
