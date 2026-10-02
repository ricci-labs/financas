import { cva } from 'class-variance-authority'

export const momentVariants = cva(
  'flex min-h-dvh flex-col items-center px-4 pt-5 pb-8 text-center transition-colors duration-slow lg:justify-center',
  {
    variants: {
      tone: {
        celebrate: 'bg-mint text-on-mint',
        calm: 'bg-sketch-paper text-ink',
      },
    },
    defaultVariants: { tone: 'celebrate' },
  },
)

export const momentBannerVariants = cva('-mx-4 -mt-5 mb-5 self-stretch empty:hidden')

export const momentArtVariants = cva(
  'flex min-h-45 w-full flex-1 basis-0 items-center justify-center lg:h-100 lg:min-h-0 lg:flex-none',
)

export const momentOwlVariants = cva('max-w-90 object-center lg:max-w-120')

export const momentBodyVariants = cva('w-full max-w-100 text-body lg:max-w-140')

export const momentTextVariants = cva('flex flex-col items-center gap-2 animate-moment-text')

export const momentTitleVariants = cva(
  'font-display text-screen-title text-balance lg:text-screen-title-lg',
)

export const momentActionsVariants = cva(
  'mt-6 flex w-full max-w-100 flex-col gap-3 animate-moment-actions lg:mt-8',
)
