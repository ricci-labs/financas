import { cva } from 'class-variance-authority'

export const appSplashVariants = cva(
  'flex min-h-dvh flex-col items-center justify-center gap-3 bg-mint px-4 text-center text-on-mint',
)

export const appSplashOwlVariants = cva('size-50 select-none')

export const appSplashSlowVariants = cva('mt-6 flex items-center gap-2 text-body-sm')

export const appSplashSpinnerVariants = cva(
  'size-4 animate-spin rounded-full border-2 border-current border-r-transparent',
)
