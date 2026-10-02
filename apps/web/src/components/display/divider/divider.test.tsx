import { Divider } from '@web/components/display/divider/divider'
import { expectNoAccessibilityViolations } from '@web/testing/accessibility'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'

describe('Divider', () => {
  it('reads as its label alone, with the lines drawn around it', async () => {
    const screen = await render(
      <div className="w-80 bg-sketch-paper">
        <Divider surface="paper">Ainda não confirmou?</Divider>
      </div>,
    )
    const divider = screen.getByText('Ainda não confirmou?')
    expect(divider.element().textContent).toBe('Ainda não confirmou?')
    const line = getComputedStyle(divider.element(), '::before')
    expect(Number.parseFloat(line.width)).toBeGreaterThan(0)
    expect(line.height).toBe('1px')
    await expectNoAccessibilityViolations(screen.container)
  })
})
