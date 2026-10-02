import { Spinner } from '@web/components/feedback/spinner/spinner'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'

describe('Spinner', () => {
  it('turns in the current colour and stays out of the accessibility tree', async () => {
    const screen = await render(<Spinner size="lg" />)
    const spinner = screen.container.querySelector('[data-slot=spinner]')
    expect(spinner?.getAttribute('aria-hidden')).toBe('true')
    expect(getComputedStyle(spinner as Element).animationName).not.toBe('none')
  })
})
