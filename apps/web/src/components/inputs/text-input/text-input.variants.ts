import { cva } from 'class-variance-authority'

export const inputBoxVariants = cva([
  'flex min-h-control items-center gap-2 rounded-md border border-border-control bg-surface px-4',
  'focus-within:border-ink focus-within:ring-1 focus-within:ring-ink',
  'has-[input[aria-invalid=true]]:border-danger has-[input[aria-invalid=true]]:ring-1 has-[input[aria-invalid=true]]:ring-danger',
  'has-[input:read-only]:border-border has-[input:read-only]:bg-sunken has-[input:read-only]:ring-0',
  'has-[input:disabled]:border-border has-[input:disabled]:bg-sunken',
])

export const inputVariants = cva(
  [
    'min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-subtle',
    'read-only:text-ink-muted disabled:text-ink-muted',
  ],
  {
    variants: {
      isMasked: { true: 'tracking-widest', false: '' },
    },
    defaultVariants: { isMasked: false },
  },
)
