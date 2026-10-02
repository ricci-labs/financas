import { cva } from 'class-variance-authority'

export const authLayoutVariants = cva(
  'flex min-h-dvh flex-col bg-page text-ink lg:grid lg:grid-cols-2',
)

export const authArtVariants = cva([
  'flex min-h-40 max-h-80 flex-1 basis-0 items-end justify-center overflow-hidden bg-mint pt-6 text-on-mint',
  'lg:max-h-none lg:min-h-0 lg:flex-col lg:items-stretch lg:justify-between lg:px-12 lg:py-10',
])

export const authOwlVariants = cva(
  'h-full w-auto max-w-85 lg:h-auto lg:w-full lg:max-w-130 lg:self-center',
)

export const authClaimVariants = cva('hidden max-w-120 flex-col gap-3 lg:flex')

export const authMainVariants = cva('flex justify-center px-4 pt-5 pb-6 lg:items-center lg:p-12')

export const authColumnVariants = cva('flex w-full max-w-100 flex-col gap-4')

export const authTitleVariants = cva('font-display text-screen-title text-balance')

export const authSubtitleVariants = cva('mt-1 text-body-sm whitespace-nowrap text-ink-muted')

export const authFooterVariants = cva('mt-1 text-center text-body-sm text-ink-muted')
