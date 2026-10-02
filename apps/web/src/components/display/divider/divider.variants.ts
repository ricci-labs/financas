import { cva } from 'class-variance-authority'

export const dividerVariants = cva(
  'flex items-center gap-3 text-label text-ink-muted before:h-px before:flex-1 after:h-px after:flex-1',
  {
    variants: {
      surface: {
        page: 'before:bg-border after:bg-border',
        paper: 'before:bg-sketch-line after:bg-sketch-line',
      },
    },
    defaultVariants: { surface: 'page' },
  },
)
