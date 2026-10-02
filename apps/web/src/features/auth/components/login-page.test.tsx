import { createMemoryHistory } from '@tanstack/react-router'
import { AppProviders } from '@web/app/providers'
import { createApp } from '@web/app/router'
import { expectNoAccessibilityViolations } from '@web/testing/accessibility'
import { account, apiError, fakeApi, sessionRequired } from '@web/testing/fake-api'
import { fieldLabelled } from '@web/testing/fields'
import type { FakeAnswer } from '@web/testing/testing.types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'

const EMAIL = 'member.a@exemplo.com'
const PASSWORD = 'café com pão de queijo'
const signupOpen = () => Response.json({ isSignupEnabled: true })
const healthy = () => Response.json({ status: 'ready', version: 'dev' })

async function openLogin(path: string, answers: Record<string, FakeAnswer>) {
  let isLoggedIn = false
  const api = fakeApi({
    'GET /api/auth/me': () => (isLoggedIn ? account() : sessionRequired()),
    'GET /api/auth/config': signupOpen,
    'GET /api/health/ready': healthy,
    ...answers,
    'POST /api/auth/login': async (request) => {
      const answer = answers['POST /api/auth/login']
      const response = answer ? await answer(request) : Response.json({ userId: 'user-a' })
      isLoggedIn = response.ok
      return response
    },
    'POST /api/auth/logout': () => {
      isLoggedIn = false
      return new Response(null, { status: 204 })
    },
  })
  const app = createApp(createMemoryHistory({ initialEntries: [path] }))
  const screen = await render(<AppProviders app={app} />)
  await expect.element(screen.getByRole('heading', { name: 'Entrar no Twise' })).toBeVisible()
  return { app, screen, api }
}

async function fillAndSubmit(
  screen: Awaited<ReturnType<typeof openLogin>>['screen'],
  password = PASSWORD,
) {
  await fieldLabelled('E-mail').fill(EMAIL)
  await fieldLabelled('Senha').fill(password)
  await screen.getByRole('button', { name: 'Entrar' }).click()
}

describe('AUTH-01 log in', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    window.dispatchEvent(new Event('online'))
  })

  it('opens with the focus on the e-mail and offers sign-up when it is open', async () => {
    const { screen } = await openLogin('/login', {})
    await expect.element(fieldLabelled('E-mail')).toHaveFocus()
    await expect.element(screen.getByRole('link', { name: 'Criar conta' })).toBeVisible()
    await expectNoAccessibilityViolations(screen.container)
  })

  it('hides "Criar conta" when sign-up is closed', async () => {
    const { screen } = await openLogin('/login', {
      'GET /api/auth/config': () => Response.json({ isSignupEnabled: false }),
    })
    await expect.element(screen.getByRole('link', { name: 'Criar conta' })).not.toBeInTheDocument()
  })

  it('logs in with the trimmed e-mail and opens where the person was going', async () => {
    const sent: unknown[] = []
    const { app, screen } = await openLogin('/login?next=%2F', {
      'POST /api/auth/login': async (request) => {
        sent.push(await request.json())
        return Response.json({ userId: 'user-a' })
      },
    })
    await fieldLabelled('E-mail').fill(`  ${EMAIL.toUpperCase()} `)
    await fieldLabelled('Senha').fill(PASSWORD)
    await screen.getByRole('button', { name: 'Entrar' }).click()

    await expect.element(screen.getByRole('heading', { name: 'Twise' })).toBeVisible()
    expect(app.router.state.location.pathname).toBe('/')
    expect(sent).toEqual([{ email: EMAIL, password: PASSWORD }])
  })

  it('never says which one is wrong, clears the password and focuses it', async () => {
    const { screen } = await openLogin('/login', {
      'POST /api/auth/login': () => apiError('INVALID_CREDENTIALS', 401),
    })
    await fillAndSubmit(screen)

    await expect.element(screen.getByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.')
    await expect.element(fieldLabelled('Senha')).toHaveValue('')
    await expect.element(fieldLabelled('Senha')).toHaveFocus()
    await expect.element(fieldLabelled('E-mail')).toHaveValue(EMAIL)
    await expectNoAccessibilityViolations(screen.container)
  })

  it('asks to confirm the e-mail and resends it to the typed address, then waits 60 s', async () => {
    const resent: unknown[] = []
    const { screen } = await openLogin('/login', {
      'POST /api/auth/login': () => apiError('EMAIL_NOT_VERIFIED', 403),
      'POST /api/auth/verify-email/resend': async (request) => {
        resent.push(await request.json())
        return new Response(null, { status: 202 })
      },
    })
    await fillAndSubmit(screen)

    await expect
      .element(
        screen
          .getByRole('alert')
          .getByText('Confirme seu e-mail antes de entrar. Procure o link que enviamos.'),
      )
      .toBeVisible()
    await screen.getByRole('button', { name: 'Reenviar e-mail de confirmação' }).click()

    await expect.element(screen.getByRole('button', { name: 'Reenviar em 60 s' })).toBeVisible()
    expect(resent).toEqual([{ email: EMAIL }])
  })

  it('waits out the limit with a countdown and points to "Esqueci minha senha"', async () => {
    const { screen } = await openLogin('/login', {
      'POST /api/auth/login': () => apiError('TOO_MANY_ATTEMPTS', 429, { 'Retry-After': '900' }),
    })
    await fillAndSubmit(screen)

    await expect
      .element(screen.getByRole('alert'))
      .toHaveTextContent('Muitas tentativas. Tente de novo em 15 minutos.')
    await expect
      .element(screen.getByRole('button', { name: /^Tente de novo em 1[45]:\d\d$/ }))
      .toBeVisible()
    await expect
      .element(
        screen.getByText('Enquanto isso, você pode trocar a senha em “Esqueci minha senha”.'),
      )
      .toBeVisible()
    expect(screen.container.querySelector('[data-scene]')?.getAttribute('data-scene')).toBe('wait')
  })

  it('shows the ref of an unexpected error and keeps what was typed', async () => {
    const { screen } = await openLogin('/login', {
      'POST /api/auth/login': () => apiError('INTERNAL_ERROR', 500),
    })
    await fillAndSubmit(screen)

    await expect
      .element(screen.getByRole('alert'))
      .toHaveTextContent('Algo deu errado. Tente de novo; se continuar, informe o código abcd1234.')
    await expect.element(fieldLabelled('Senha')).toHaveValue(PASSWORD)
    await expect
      .element(screen.getByRole('button', { name: 'Entrar' }))
      .not.toHaveAttribute('aria-disabled')
  })

  it('locks the button while offline and says why', async () => {
    const { screen } = await openLogin('/login', {})
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    window.dispatchEvent(new Event('offline'))

    await expect
      .element(screen.getByText('Sem conexão. Verifique a internet e tente de novo.'))
      .toBeVisible()
    await expect
      .element(screen.getByText('Sem conexão. Assim que a internet voltar, o botão libera.'))
      .toBeVisible()
    await fieldLabelled('E-mail').fill(EMAIL)
    await fieldLabelled('Senha').fill(PASSWORD)
    await expect
      .element(screen.getByRole('button', { name: 'Entrar' }))
      .toHaveAttribute('aria-disabled', 'true')
  })

  it.each([
    ['session-ended', 'Sua sessão terminou. Entre de novo.'],
    ['logged-out', 'Você saiu.'],
    [
      'password-changed',
      'Senha trocada. Entre com a nova senha. Por segurança, saímos de todos os aparelhos.',
    ],
    ['email-verified', 'E-mail confirmado'],
  ])('shows the arrival message for %s', async (notice, message) => {
    const { screen } = await openLogin(`/login?notice=${notice}`, {})
    await expect.element(screen.getByRole('status').filter({ hasText: message })).toBeVisible()
  })

  it('logs out from the app back to log in with "Você saiu."', async () => {
    const { screen } = await openLogin('/login?next=%2F', {
      'POST /api/auth/logout': () => new Response(null, { status: 204 }),
    })
    await fillAndSubmit(screen)
    await expect.element(screen.getByRole('heading', { name: 'Twise' })).toBeVisible()

    await screen.getByRole('button', { name: 'Sair' }).click()

    await expect.element(screen.getByRole('heading', { name: 'Entrar no Twise' })).toBeVisible()
    await expect.element(screen.getByText('Você saiu.')).toBeVisible()
  })
})
