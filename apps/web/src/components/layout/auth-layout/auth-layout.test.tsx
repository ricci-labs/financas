import { TextLink } from '@web/components/actions/text-link'
import { AuthLayout } from '@web/components/layout/auth-layout/auth-layout'
import { expectNoAccessibilityViolations } from '@web/testing/accessibility'
import { afterEach, describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'

function renderLogin() {
  return render(
    <AuthLayout
      scene="welcome"
      title="Entrar no Twise"
      subtitle="Bom te ver de novo! Vamos ver como anda o mês?"
      footer={
        <>
          Ainda não tem conta? <TextLink href="/signup">Criar conta</TextLink>
        </>
      }
    >
      <p>Formulário</p>
    </AuthLayout>,
  )
}

describe('AuthLayout', () => {
  afterEach(() => {
    document.documentElement.classList.remove('dark')
  })

  it('titles the screen and keeps the owl decorative', async () => {
    const screen = await renderLogin()
    await expect
      .element(screen.getByRole('heading', { level: 1, name: 'Entrar no Twise' }))
      .toBeVisible()
    await expect.element(screen.getByRole('link', { name: 'Criar conta' })).toBeVisible()
    expect(screen.container.querySelector('[data-slot=owl-scene]')?.getAttribute('alt')).toBe('')
    await expectNoAccessibilityViolations(screen.container)
  })

  it('always shows the light theme, and gives the chosen theme back when it leaves', async () => {
    document.documentElement.classList.add('dark')
    const screen = await renderLogin()

    expect(document.documentElement.classList.contains('dark')).toBe(false)
    await screen.unmount()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})
