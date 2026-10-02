import { cva } from 'class-variance-authority'

export const owlKitVariants = cva(
  'pointer-events-none relative block aspect-owl size-full select-none',
)

export const owlKitDrawingVariants = cva('absolute inset-0 [&>svg]:size-full', {
  variants: {
    isReady: {
      true: '',
      false: 'invisible',
    },
  },
})
