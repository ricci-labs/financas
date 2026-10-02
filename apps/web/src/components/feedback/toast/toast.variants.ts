import { cva } from 'class-variance-authority'

export const toastVariants = cva(
  'flex w-full items-center gap-3 rounded-lg bg-surface px-4 py-3 text-body-sm text-ink shadow-float md:w-90',
)

export const toastActionVariants = cva(
  'ml-auto shrink-0 font-semibold text-mint-ink underline underline-stroke underline-offset-4',
)
