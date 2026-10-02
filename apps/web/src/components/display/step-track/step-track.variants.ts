import { cva } from 'class-variance-authority'

export const stepTrackVariants = cva('mt-4 flex w-full max-w-85 items-start justify-center')

export const stepVariants = cva(
  'relative flex flex-1 flex-col items-center gap-1.5 text-caption text-ink',
  {
    variants: {
      status: {
        done: '',
        now: '',
        next: 'font-medium',
      },
    },
  },
)

export const stepDotVariants = cva(
  'relative grid size-7 place-items-center rounded-full text-caption font-bold [&_svg]:size-4',
  {
    variants: {
      status: {
        done: 'bg-ink text-mint',
        now: 'bg-surface text-ink ring-2 ring-ink',
        next: 'inset-ring-2 inset-ring-ink',
      },
    },
  },
)

export const stepLineVariants = cva('absolute top-3.25 right-1/2 -left-1/2 mx-4.5', {
  variants: {
    isReached: {
      true: 'h-0.5 rounded-full bg-ink',
      false: 'h-0 border-t-2 border-dashed border-ink',
    },
  },
})
