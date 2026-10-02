import { Tip } from '@web/components/feedback/tip/tip'
import { expectNoAccessibilityViolations } from '@web/testing/accessibility'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'

describe('Tip', () => {
  it('shows one line of help with a decorative icon', async () => {
    const screen = await render(<Tip>Não chegou? Olhe o spam e a aba Promoções.</Tip>)
    await expect
      .element(screen.getByText('Não chegou? Olhe o spam e a aba Promoções.'))
      .toBeVisible()
    expect(screen.container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    await expectNoAccessibilityViolations(screen.container)
  })
})
