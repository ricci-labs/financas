import { cva } from 'class-variance-authority'

export const textLinkVariants = cva(
  'cursor-pointer font-semibold underline underline-stroke underline-offset-4',
  {
    variants: {
      tone: {
        brand: 'text-mint-ink',
        inherit: 'text-current',
      },
    },
    defaultVariants: { tone: 'brand' },
  },
)
