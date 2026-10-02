import { cva } from 'class-variance-authority'

export const buttonVariants = cva(
  [
    'inline-flex cursor-pointer items-center justify-center gap-2 rounded-full text-button whitespace-nowrap select-none',
    'transition duration-fast active:scale-98 [&_svg]:size-5 [&_svg]:shrink-0',
    'aria-disabled:cursor-not-allowed aria-disabled:bg-sunken aria-disabled:text-ink-subtle aria-disabled:shadow-none aria-disabled:active:scale-100',
    'data-loading:cursor-progress data-loading:bg-action-primary-hover data-loading:text-on-action-primary',
    'data-waiting:bg-sunken data-waiting:text-ink-muted data-waiting:tabular-nums',
  ],
  {
    variants: {
      variant: {
        primary: 'bg-action-primary text-on-action-primary hover:bg-action-primary-hover',
        secondary: 'bg-action-secondary text-ink hover:bg-action-secondary-hover',
        outline: 'inset-stroke bg-surface text-ink',
        tertiary: 'bg-transparent px-3 text-mint-ink underline underline-stroke underline-offset-3',
        danger: 'bg-danger-soft text-danger hover:inset-ring-2 hover:inset-ring-danger',
      },
      size: {
        md: 'min-h-control px-6',
        sm: 'min-h-control-sm px-4 text-label',
        icon: 'size-control p-0',
      },
      width: {
        auto: '',
        full: 'w-full',
      },
    },
    compoundVariants: [{ variant: 'tertiary', size: 'md', class: 'px-3' }],
    defaultVariants: { variant: 'primary', size: 'md', width: 'auto' },
  },
)

export const spinnerVariants = cva(
  'size-4.5 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent',
)
