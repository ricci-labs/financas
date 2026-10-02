import { Button } from '@web/components/actions/button'
import { Alert } from '@web/components/feedback/alert/alert'
import { expectNoAccessibilityViolations } from '@web/testing/accessibility'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'

describe('Alert', () => {
  it('announces form errors right away and arrival messages politely', async () => {
    const screen = await render(
      <div>
        <Alert tone="danger" isUrgent>
          E-mail ou senha incorretos.
        </Alert>
        <Alert tone="info">Você saiu.</Alert>
      </div>,
    )
    await expect.element(screen.getByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.')
    await expect.element(screen.getByRole('status')).toHaveTextContent('Você saiu.')
  })

  it('always shows an icon next to the colour, and its action', async () => {
    const screen = await render(
      <Alert
        tone="warning"
        isUrgent
        action={<Button size="sm">Reenviar e-mail de confirmação</Button>}
      >
        Confirme seu e-mail antes de entrar.
      </Alert>,
    )
    expect(screen.container.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    await expect
      .element(screen.getByRole('button', { name: 'Reenviar e-mail de confirmação' }))
      .toBeVisible()
  })

  it('has no accessibility violations in any tone', async () => {
    const screen = await render(
      <div>
        <Alert tone="info">Você saiu.</Alert>
        <Alert tone="success">Senha trocada.</Alert>
        <Alert tone="warning">Muitas tentativas.</Alert>
        <Alert tone="danger">E-mail ou senha incorretos.</Alert>
      </div>,
    )
    await expectNoAccessibilityViolations(screen.container)
  })
})
