import { cva } from 'class-variance-authority'

export const logoVariants = cva('block select-none', {
  variants: {
    variant: {
      full: 'h-7 w-auto',
      icon: 'size-8',
    },
  },
  defaultVariants: { variant: 'full' },
})
