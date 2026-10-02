import { cva } from 'class-variance-authority'

export const fieldVariants = cva('flex flex-col gap-2')

export const labelVariants = cva('text-label text-ink')

export const requiredMarkVariants = cva('ml-0.5 text-danger')

export const helpVariants = cva('-mt-1 text-body-sm text-ink-muted')

export const errorVariants = cva(
  'flex items-start gap-1 text-label text-danger empty:hidden [&_svg]:mt-px [&_svg]:size-4.5 [&_svg]:shrink-0',
)

export const counterVariants = cva('text-right text-caption text-ink-muted tabular-nums')
