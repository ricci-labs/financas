import { createMemoryHistory } from '@tanstack/react-router'
import { AppProviders } from '@web/app/providers'
import { createApp } from '@web/app/router'
import { expectNoAccessibilityViolations } from '@web/testing/accessibility'
import { apiError, fakeApi, sessionRequired } from '@web/testing/fake-api'
import { fieldLabelled } from '@web/testing/fields'
import type { FakeAnswer } from '@web/testing/testing.types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'

const EMAIL = 'member.a@exemplo.com'
const PASSWORD = 'café com pão de queijo'
const SIGN_UP = 'POST /api/auth/signup'
const ACCEPTED = () => new Response(null, { status: 202 })
const ONE_MINUTE_MS = 60_000
const TOAST_SETTLE_MS = 500

async function openSignUp(answers: Record<string, FakeAnswer>, isSignupEnabled = true) {
  fakeApi({
    'GET /api/auth/me': sessionRequired,
    'GET /api/auth/config': () => Response.json({ isSignupEnabled }),
    ...answers,
  })
  const app = createApp(createMemoryHistory({ initialEntries: ['/signup'] }))
  const screen = await render(<AppProviders app={app} />)
  return { app, screen }
}

async function fillAndSubmit(screen: Awaited<ReturnType<typeof openSignUp>>['screen']) {
  await expect.element(screen.getByRole('heading', { name: 'Criar sua conta' })).toBeVisible()
  await fieldLabelled('Seu nome').fill('  Member A ')
  await fieldLabelled('E-mail').fill(EMAIL.toUpperCase())
  await fieldLabelled('Senha').fill(PASSWORD)
  await screen.getByRole('button', { name: 'Criar conta' }).click()
}

describe('AUTH-02 sign up', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('opens with the focus on the name and the password help always visible', async () => {
    const { screen } = await openSignUp({})
    await expect.element(screen.getByRole('heading', { name: 'Criar sua conta' })).toBeVisible()
    await expect.element(fieldLabelled('Seu nome')).toHaveFocus()
    await expect
      .element(
        screen.getByText('Use pelo menos 12 caracteres. Uma frase fácil de lembrar funciona bem.'),
      )
      .toBeVisible()
    await expect
      .element(screen.getByRole('link', { name: 'Entrar' }))
      .toHaveAttribute('href', '/login')
    await expectNoAccessibilityViolations(screen.container)
  })

  it('shows the closed screen when public sign-up is off', async () => {
    const { screen } = await openSignUp({}, false)
    await expect
      .element(screen.getByRole('heading', { name: 'O cadastro está fechado' }))
      .toBeVisible()
    await expect.element(screen.getByText('Peça um convite a quem usa o Twise.')).toBeVisible()
    await expect
      .element(screen.getByRole('link', { name: 'Ir para o login' }))
      .toHaveAttribute('href', '/login')
    await expectNoAccessibilityViolations(screen.container)
  })

  it('switches to the closed screen if the API turned sign-up off meanwhile, with no toast', async () => {
    const { screen } = await openSignUp({ [SIGN_UP]: () => apiError('SIGNUP_DISABLED', 403) })
    await fillAndSubmit(screen)
    await expect
      .element(screen.getByRole('heading', { name: 'O cadastro está fechado' }))
      .toBeVisible()
    await new Promise((resolve) => setTimeout(resolve, TOAST_SETTLE_MS))
    expect(document.querySelector('[data-slot=toast]')).toBeNull()
  })

  it('sends the schema values and hands off to the inbox, naming the e-mail button', async () => {
    const sent: unknown[] = []
    const { screen } = await openSignUp({
      [SIGN_UP]: async (request) => {
        sent.push(await request.json())
        return ACCEPTED()
      },
    })
    await fillAndSubmit(screen)

    await expect.element(screen.getByRole('heading', { name: 'Confira seu e-mail' })).toBeVisible()
    await expect.element(screen.getByText(EMAIL)).toBeVisible()
    await expect
      .element(screen.getByText('Confirmar e-mail', { exact: true }).first())
      .toBeVisible()
    await expect.element(screen.getByText('Pode fechar esta tela.')).toBeVisible()
    await expect
      .element(screen.getByText('Não chegou? Olhe o spam e a aba Promoções.'))
      .toBeVisible()
    await expect.element(screen.getByRole('button', { name: 'Reenviar em 60 s' })).toBeVisible()
    expect(sent).toEqual([{ displayName: 'Member A', email: EMAIL, password: PASSWORD }])
    await expectNoAccessibilityViolations(screen.container)
  })

  it('lets the e-mail be sent again after 60 s, says so and waits again', async () => {
    const resent: unknown[] = []
    const { screen } = await openSignUp({
      [SIGN_UP]: ACCEPTED,
      'POST /api/auth/verify-email/resend': async (request) => {
        resent.push(await request.json())
        return ACCEPTED()
      },
    })
    await fillAndSubmit(screen)
    await expect.element(screen.getByRole('button', { name: 'Reenviar em 60 s' })).toBeVisible()

    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.now() + ONE_MINUTE_MS)
    await expect
      .element(screen.getByRole('button', { name: 'Reenviar e-mail' }), { timeout: 3000 })
      .toBeVisible()
    await screen.getByRole('button', { name: 'Reenviar e-mail' }).click()

    await expect.element(page.getByText('Enviamos de novo.')).toBeVisible()
    await expect.element(screen.getByRole('button', { name: 'Reenviar em 60 s' })).toBeVisible()
    expect(resent).toEqual([{ email: EMAIL }])
  })

  it('waits out the limit with a countdown, keeping what was typed', async () => {
    const { screen } = await openSignUp({
      [SIGN_UP]: () => apiError('TOO_MANY_ATTEMPTS', 429, { 'Retry-After': '2400' }),
    })
    await fillAndSubmit(screen)

    await expect
      .element(screen.getByRole('alert'))
      .toHaveTextContent('Muitas tentativas. Tente de novo em 40 minutos.')
    await expect
      .element(screen.getByRole('button', { name: /^Tente de novo em (40:00|39:5\d)$/ }))
      .toBeVisible()
    await expect.element(fieldLabelled('Seu nome')).toHaveValue('  Member A ')
  })
})
