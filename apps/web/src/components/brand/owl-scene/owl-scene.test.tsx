import { Logo } from '@web/components/brand/logo'
import { OWL_SCENE_NAMES, OwlScene } from '@web/components/brand/owl-scene/owl-scene'
import { expectNoAccessibilityViolations } from '@web/testing/accessibility'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'

describe('OwlScene', () => {
  it('draws every scene as a decorative image that loads', async () => {
    const screen = await render(
      <div>
        {OWL_SCENE_NAMES.map((scene) => (
          <OwlScene key={scene} scene={scene} />
        ))}
      </div>,
    )
    const images = [...screen.container.querySelectorAll('img')]
    expect(images).toHaveLength(OWL_SCENE_NAMES.length)
    expect(images.every((image) => image.getAttribute('alt') === '')).toBe(true)
    await Promise.all(images.map((image) => image.decode()))
    expect(images.every((image) => image.naturalWidth > 0)).toBe(true)
    await expectNoAccessibilityViolations(screen.container)
  })
})

describe('Logo', () => {
  it('names the brand for screen readers', async () => {
    const screen = await render(<Logo />)
    await expect.element(screen.getByRole('img', { name: 'twise' })).toBeVisible()
  })
})
