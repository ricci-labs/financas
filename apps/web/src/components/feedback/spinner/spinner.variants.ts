import { cva } from 'class-variance-authority'

export const spinnerVariants = cva(
  'inline-block shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent',
  {
    variants: {
      size: {
        sm: 'size-3.5',
        md: 'size-4',
        lg: 'size-4.5',
      },
    },
    defaultVariants: { size: 'md' },
  },
)
