import { cn } from '@web/lib/cn'
import { describe, expect, it } from 'vitest'

describe('cn', () => {
  it('keeps a type style next to a text colour of the design', () => {
    expect(cn('text-button text-on-action-primary')).toBe('text-button text-on-action-primary')
  })

  it('lets the later class of the same kind win', () => {
    expect(cn('text-ink', 'text-mint-ink')).toBe('text-mint-ink')
    expect(cn('text-body', 'text-label')).toBe('text-label')
    expect(cn('h-control', 'h-control-sm')).toBe('h-control-sm')
    expect(cn('shadow-float', 'shadow-dialog')).toBe('shadow-dialog')
    expect(cn('bg-page', 'bg-surface')).toBe('bg-surface')
  })

  it('joins conditional classes like clsx', () => {
    expect(cn('px-6', false && 'hidden', { 'w-full': true })).toBe('px-6 w-full')
  })
})
