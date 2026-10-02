import { OwlKit } from '@web/components/brand/owl-kit/owl-kit'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'

function piece(id: string) {
  return document.querySelector(`[data-slot=owl-kit] svg #${id}`)
}

function runningAnimationsOf(id: string) {
  return (piece(id)?.getAnimations() ?? []).filter((animation) => animation.playState === 'running')
}

describe('OwlKit', () => {
  it('draws the layered owl inline, hidden from assistive technology', async () => {
    const screen = await render(<OwlKit kit="closed" />)
    await expect.poll(() => piece('k-lockBody')).not.toBeNull()
    const kit = screen.container.querySelector('[data-slot=owl-kit]')
    expect(kit?.getAttribute('aria-hidden')).toBe('true')
    expect(kit?.querySelector('[data-slot=owl-scene]')).toBeNull()
  })

  it('waits in its first look, then plays the sequence once the event comes', async () => {
    const screen = await render(<OwlKit kit="confirm" phase="before" />)
    await expect.poll(() => piece('k-check-circulo')).not.toBeNull()
    expect(getComputedStyle(piece('k-check-circulo') as Element).opacity).toBe('0')
    expect(
      runningAnimationsOf('k-ampulheta').map(
        (animation) => animation.effect?.getTiming().iterations,
      ),
    ).toEqual([Number.POSITIVE_INFINITY])

    await screen.rerender(<OwlKit kit="confirm" phase="after" />)
    await expect.poll(() => runningAnimationsOf('k-check-circulo').length).toBe(1)
    expect(runningAnimationsOf('k-check-circulo')[0]?.effect?.getTiming().iterations).toBe(1)
  })
})
