import { cva } from 'class-variance-authority'

export const appSplashVariants = cva(
  'relative flex min-h-dvh flex-col items-center justify-center gap-2.5 bg-mint px-4 text-center text-on-mint',
)

export const appSplashOwlVariants = cva('size-50 select-none [&>svg]:size-full')

export const appSplashSlowVariants = cva(
  'absolute inset-x-0 bottom-14 flex items-center justify-center gap-2 text-body-sm',
)
