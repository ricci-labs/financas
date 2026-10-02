import { OwlEntrance } from '@web/components/brand/owl-entrance/owl-entrance'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'

function drawn() {
  return document.querySelector('[data-slot=owl-kit]')?.getAttribute('data-owl-kit') ?? null
}

function still() {
  return document.querySelector('[data-slot=owl-scene]')?.getAttribute('data-scene') ?? null
}

describe('OwlEntrance', () => {
  it('plays the scene entrance, drawn inline and hidden from assistive technology', async () => {
    await render(<OwlEntrance scene="envelope" />)
    await expect
      .poll(() => document.querySelector('[data-slot=owl-kit] svg #k-envelope'))
      .not.toBeNull()
    expect(drawn()).toBe('entrance-envelope')
    expect(document.querySelector('[data-slot=owl-kit]')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('plays a form scene only on its first opening in the session', async () => {
    const first = await render(<OwlEntrance scene="key" isOncePerSession />)
    expect(drawn()).toBe('entrance-key')
    await first.unmount()

    await render(<OwlEntrance scene="key" isOncePerSession />)
    expect(drawn()).toBeNull()
    expect(still()).toBe('key')
  })

  it('plays the entrance of a scene that comes in later, such as waiting', async () => {
    const screen = await render(<OwlEntrance scene="signUp" isOncePerSession />)
    await screen.rerender(<OwlEntrance scene="wait" isOncePerSession />)
    expect(drawn()).toBe('entrance-wait')
  })

  it('stays still when asked, and for a scene with no entrance', async () => {
    const quiet = await render(<OwlEntrance scene="invitation" isStill />)
    expect(still()).toBe('invitation')
    await quiet.unmount()

    await render(<OwlEntrance scene="confirmed" />)
    expect(still()).toBe('confirmed')
  })
})
