import { TextLink } from '@web/components/actions/text-link/text-link'
import { expectNoAccessibilityViolations } from '@web/testing/accessibility'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'

describe('TextLink', () => {
  it('is a link by default and takes another element through render', async () => {
    const screen = await render(
      <p>
        <TextLink href="/signup">Criar conta</TextLink>
        <TextLink render={<button type="button" />}>Sair</TextLink>
      </p>,
    )
    await expect
      .element(screen.getByRole('link', { name: 'Criar conta' }))
      .toHaveAttribute('href', '/signup')
    await expect.element(screen.getByRole('button', { name: 'Sair' })).toBeVisible()
    await expectNoAccessibilityViolations(screen.container)
  })
})
