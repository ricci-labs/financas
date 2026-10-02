import { createMemoryHistory } from '@tanstack/react-router'
import { AppProviders } from '@web/app/providers'
import { createApp } from '@web/app/router'
import { expectNoAccessibilityViolations } from '@web/testing/accessibility'
import { apiError, fakeApi, sessionRequired } from '@web/testing/fake-api'
import { fieldLabelled } from '@web/testing/fields'
import type { FakeAnswer } from '@web/testing/testing.types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'

const TOKEN = 'reset-token-123'
const PASSWORD = 'café com pão de queijo'
const RESET = 'POST /api/auth/password/reset'
const NO_CONTENT = () => new Response(null, { status: 204 })
const MISMATCH = 'As senhas não são iguais.'

async function openLink(
  answers: Record<string, FakeAnswer>,
  path = `/reset-password#token=${TOKEN}`,
) {
  const sent: unknown[] = []
  fakeApi({
    'GET /api/auth/me': sessionRequired,
    'GET /api/auth/config': () => Response.json({ isSignupEnabled: false }),
    ...answers,
    [RESET]: async (request) => {
      sent.push(await request.json())
      return answers[RESET]?.(request) ?? NO_CONTENT()
    },
  })
  const app = createApp(createMemoryHistory({ initialEntries: [path] }))
  const screen = await render(<AppProviders app={app} />)
  return { app, screen, sent }
}

async function fillPasswords(
  screen: Awaited<ReturnType<typeof openLink>>['screen'],
  confirmation: string,
) {
  await expect.element(screen.getByRole('heading', { name: 'Crie uma nova senha' })).toBeVisible()
  await fieldLabelled('Nova senha').fill(PASSWORD)
  await fieldLabelled('Repita a nova senha').fill(confirmation)
}

describe('AUTH-05 reset password', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('opens the form with the token out of the address and nothing sent yet', async () => {
    const { app, screen, sent } = await openLink({})
    await expect.element(screen.getByRole('heading', { name: 'Crie uma nova senha' })).toBeVisible()
    await expect.element(screen.getByText('Depois, é só entrar com ela.')).toBeVisible()
    await expect.element(fieldLabelled('Nova senha')).toHaveFocus()
    await expect
      .element(
        screen.getByText('Use pelo menos 12 caracteres. Uma frase fácil de lembrar funciona bem.'),
      )
      .toBeVisible()
    await expect
      .element(screen.getByRole('link', { name: 'Voltar para o login' }))
      .toHaveAttribute('href', '/login')
    expect(app.router.history.location.hash).toBe('')
    expect(sent).toEqual([])
    await expectNoAccessibilityViolations(screen.container)
  })

  it('says the passwords differ on leaving the second field, until they match', async () => {
    const { screen } = await openLink({})
    await fillPasswords(screen, 'café com pão de queij')
    await expect.element(screen.getByText(MISMATCH)).not.toBeInTheDocument()

    await userEvent.tab()
    await expect.element(screen.getByText(MISMATCH)).toBeVisible()
    await expect
      .element(fieldLabelled('Repita a nova senha'))
      .toHaveAttribute('aria-invalid', 'true')
    await expectNoAccessibilityViolations(screen.container)

    await fieldLabelled('Repita a nova senha').fill(PASSWORD)
    await expect.element(screen.getByText(MISMATCH)).not.toBeInTheDocument()
  })

  it('sends only the token and the new password, then opens the log in with the notice', async () => {
    const { app, screen, sent } = await openLink({})
    await fillPasswords(screen, PASSWORD)
    await screen.getByRole('button', { name: 'Trocar senha' }).click()

    await expect.element(screen.getByRole('heading', { name: 'Entrar no Twise' })).toBeVisible()
    await expect
      .element(
        screen.getByText(
          'Senha trocada. Entre com a nova senha. Por segurança, saímos de todos os aparelhos.',
        ),
      )
      .toBeVisible()
    expect(app.router.state.location.href).toBe('/login?notice=password-changed')
    expect(sent).toEqual([{ token: TOKEN, password: PASSWORD }])
  })

  it('replaces the form with a calm notice when the link no longer works', async () => {
    const { screen } = await openLink({ [RESET]: () => apiError('LINK_INVALID', 400) })
    await fillPasswords(screen, PASSWORD)
    await screen.getByRole('button', { name: 'Trocar senha' }).click()

    await expect
      .element(screen.getByRole('heading', { name: 'Este link não vale mais' }))
      .toBeVisible()
    await expect
      .element(
        screen.getByText('Já foi usado ou expirou. O link para trocar a senha vale por 1 hora.'),
      )
      .toBeVisible()
    await expect
      .element(screen.getByRole('link', { name: 'Pedir um novo link' }))
      .toHaveAttribute('href', '/forgot-password')
    await expect
      .element(screen.getByRole('link', { name: 'Voltar para o login' }))
      .toHaveAttribute('href', '/login')
    await expectNoAccessibilityViolations(screen.container)
  })

  it('shows the same notice at once for a link with no token', async () => {
    const { screen } = await openLink({}, '/reset-password')
    await expect
      .element(screen.getByRole('heading', { name: 'Este link não vale mais' }))
      .toBeVisible()
  })

  it('waits out the limit with a countdown, keeping what was typed', async () => {
    const { screen } = await openLink({
      [RESET]: () => apiError('TOO_MANY_ATTEMPTS', 429, { 'Retry-After': '2400' }),
    })
    await fillPasswords(screen, PASSWORD)
    await screen.getByRole('button', { name: 'Trocar senha' }).click()

    await expect
      .element(screen.getByRole('alert'))
      .toHaveTextContent('Muitas tentativas. Tente de novo em 40 minutos.')
    await expect
      .element(screen.getByRole('button', { name: /^Tente de novo em (40:00|39:5\d)$/ }))
      .toBeVisible()
    await expect.element(fieldLabelled('Nova senha')).toHaveValue(PASSWORD)
    await expect.element(fieldLabelled('Repita a nova senha')).toHaveValue(PASSWORD)
  })
})
