import { createMemoryHistory } from '@tanstack/react-router'
import { AppProviders } from '@web/app/providers'
import { createApp } from '@web/app/router'
import { expectNoAccessibilityViolations } from '@web/testing/accessibility'
import { apiError, fakeApi, sessionRequired } from '@web/testing/fake-api'
import { fieldLabelled } from '@web/testing/fields'
import type { FakeAnswer } from '@web/testing/testing.types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'

const EMAIL = 'member.a@exemplo.com'
const FORGOT = 'POST /api/auth/password/forgot'
const ACCEPTED = () => new Response(null, { status: 202 })

async function openAt(path: string, answers: Record<string, FakeAnswer> = {}) {
  fakeApi({
    'GET /api/auth/me': sessionRequired,
    'GET /api/auth/config': () => Response.json({ isSignupEnabled: false }),
    ...answers,
  })
  const app = createApp(createMemoryHistory({ initialEntries: [path] }))
  const screen = await render(<AppProviders app={app} />)
  return { app, screen }
}

describe('AUTH-04 forgot password', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('brings the e-mail typed on the log in, without putting it in the address', async () => {
    const { app, screen } = await openAt('/login')
    await expect.element(screen.getByRole('heading', { name: 'Entrar no Twise' })).toBeVisible()
    await fieldLabelled('E-mail').fill(` ${EMAIL} `)
    await screen.getByRole('link', { name: 'Esqueci minha senha' }).click()

    await expect.element(screen.getByRole('heading', { name: 'Esqueceu a senha?' })).toBeVisible()
    await expect.element(screen.getByText('A gente manda um link para criar outra.')).toBeVisible()
    await expect.element(fieldLabelled('E-mail da conta')).toHaveValue(EMAIL)
    await expect.element(fieldLabelled('E-mail da conta')).toHaveFocus()
    expect(app.router.state.location.href).toBe('/forgot-password')
    await expect
      .element(screen.getByRole('link', { name: 'Voltar para o login' }))
      .toHaveAttribute('href', '/login')
    await expectNoAccessibilityViolations(screen.container)
  })

  it('opens empty when it comes from anywhere else', async () => {
    const { screen } = await openAt('/forgot-password')
    await expect.element(screen.getByRole('heading', { name: 'Esqueceu a senha?' })).toBeVisible()
    await expect.element(fieldLabelled('E-mail da conta')).toHaveValue('')
    await expect.element(fieldLabelled('E-mail da conta')).toHaveFocus()
  })

  it('sends the schema value and hands off to the inbox, with no resend', async () => {
    const sent: unknown[] = []
    const { screen } = await openAt('/forgot-password', {
      [FORGOT]: async (request) => {
        sent.push(await request.json())
        return ACCEPTED()
      },
    })
    await expect.element(screen.getByRole('heading', { name: 'Esqueceu a senha?' })).toBeVisible()
    await fieldLabelled('E-mail da conta').fill(EMAIL.toUpperCase())
    await screen.getByRole('button', { name: 'Enviar link' }).click()

    await expect.element(screen.getByRole('heading', { name: 'Confira seu e-mail' })).toBeVisible()
    await expect
      .element(screen.getByText(/^Se houver uma conta com member\.a@exemplo\.com, enviamos/))
      .toBeVisible()
    await expect.element(screen.getByRole('list', { name: 'Trocar a senha' })).toBeVisible()
    await expect
      .element(screen.getByRole('listitem').filter({ hasText: 'Abrir o e-mail' }))
      .toHaveAttribute('aria-current', 'step')
    await expect
      .element(screen.getByRole('link', { name: 'Voltar para o login' }))
      .toHaveAttribute('href', '/login')
    expect(screen.container.querySelectorAll('button')).toHaveLength(0)
    expect(sent).toEqual([{ email: EMAIL }])
    await expectNoAccessibilityViolations(screen.container)
  })

  it('waits out the limit with a countdown, keeping the e-mail', async () => {
    const { screen } = await openAt('/forgot-password', {
      [FORGOT]: () => apiError('TOO_MANY_ATTEMPTS', 429, { 'Retry-After': '2400' }),
    })
    await expect.element(screen.getByRole('heading', { name: 'Esqueceu a senha?' })).toBeVisible()
    await fieldLabelled('E-mail da conta').fill(EMAIL)
    await screen.getByRole('button', { name: 'Enviar link' }).click()

    await expect
      .element(screen.getByRole('alert'))
      .toHaveTextContent('Muitas tentativas. Tente de novo em 40 minutos.')
    await expect
      .element(screen.getByRole('button', { name: /^Tente de novo em (40:00|39:5\d)$/ }))
      .toBeVisible()
    await expect.element(fieldLabelled('E-mail da conta')).toHaveValue(EMAIL)
  })
})
