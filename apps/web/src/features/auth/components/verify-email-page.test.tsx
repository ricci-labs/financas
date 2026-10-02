import { createMemoryHistory } from '@tanstack/react-router'
import { AppProviders } from '@web/app/providers'
import { createApp } from '@web/app/router'
import { expectNoAccessibilityViolations } from '@web/testing/accessibility'
import { backgroundOfClass } from '@web/testing/colors'
import { apiError, fakeApi, sessionRequired } from '@web/testing/fake-api'
import { fieldLabelled } from '@web/testing/fields'
import type { FakeAnswer } from '@web/testing/testing.types'
import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'

const TOKEN = 'link-token-123'
const EMAIL = 'member.a@exemplo.com'
const VERIFY = 'POST /api/auth/verify-email'
const RESEND = 'POST /api/auth/verify-email/resend'
const NO_CONTENT = () => new Response(null, { status: 204 })
const ACCEPTED = () => new Response(null, { status: 202 })

async function openLink(
  answers: Record<string, FakeAnswer>,
  path = `/verify-email#token=${TOKEN}`,
) {
  const sent: unknown[] = []
  fakeApi({
    'GET /api/auth/me': sessionRequired,
    ...answers,
    [VERIFY]: async (request) => {
      sent.push(await request.json())
      return answers[VERIFY]?.(request) ?? NO_CONTENT()
    },
  })
  const app = createApp(createMemoryHistory({ initialEntries: [path] }))
  const screen = await render(
    <StrictMode>
      <AppProviders app={app} />
    </StrictMode>,
  )
  return { app, screen, sent }
}

function momentBackground() {
  const moment = document.querySelector('[data-slot=moment-screen]')
  return moment && getComputedStyle(moment).backgroundColor
}

describe('AUTH-03 verify email', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('confirms on its own once, clears the token from the address and offers log in', async () => {
    let answer: (response: Response) => void = () => undefined
    const { app, screen, sent } = await openLink({
      [VERIFY]: () => new Promise((resolve) => (answer = resolve)),
    })

    await expect
      .element(screen.getByRole('heading', { name: 'Confirmando seu e-mail' }))
      .toBeVisible()
    await expect.element(screen.getByText('Só um instante.')).toBeVisible()
    await expect
      .element(screen.getByText('Pode deixar esta tela aberta. Ela muda sozinha.'))
      .toBeVisible()
    await expect
      .element(screen.getByRole('listitem').filter({ hasText: 'E-mail confirmado' }))
      .toHaveAttribute('aria-current', 'step')
    expect(app.router.history.location.hash).toBe('')
    expect(app.router.history.location.pathname).toBe('/verify-email')
    await expectNoAccessibilityViolations(screen.container)

    answer(NO_CONTENT())
    await expect.element(screen.getByRole('heading', { name: 'E-mail confirmado!' })).toBeVisible()
    await expect.element(screen.getByText('Agora é só entrar.')).toBeVisible()
    await expect
      .element(screen.getByText(/^Depois de entrar, vocês montam o espaço do casal/))
      .toBeVisible()
    await expect
      .element(screen.getByRole('link', { name: 'Entrar' }))
      .toHaveAttribute('href', '/login?notice=email-verified')
    expect(sent).toEqual([{ token: TOKEN }])
    await expectNoAccessibilityViolations(screen.container)
  })

  it('turns calm on a used or expired link and sends a new one to the typed e-mail', async () => {
    const resent: unknown[] = []
    const { screen } = await openLink({
      [VERIFY]: () => apiError('LINK_INVALID', 400),
      [RESEND]: async (request) => {
        resent.push(await request.json())
        return ACCEPTED()
      },
    })

    await expect
      .element(screen.getByRole('heading', { name: 'Este link não vale mais' }))
      .toBeVisible()
    await expect.poll(momentBackground).toBe(backgroundOfClass('bg-sketch-paper'))
    await expect
      .element(screen.getByText('Já foi usado ou expirou. Se você já confirmou, é só entrar.'))
      .toBeVisible()
    await expect
      .element(screen.getByRole('link', { name: 'Entrar' }))
      .toHaveAttribute('href', '/login')
    await expect.element(screen.getByText('Ainda não confirmou?')).toBeVisible()
    await expectNoAccessibilityViolations(screen.container)

    await fieldLabelled('E-mail').fill(EMAIL.toUpperCase())
    await screen.getByRole('button', { name: 'Reenviar confirmação' }).click()

    await expect.element(screen.getByRole('heading', { name: 'Confira seu e-mail' })).toBeVisible()
    await expect
      .element(
        screen.getByText(/^Se member\.a@exemplo\.com puder ser usado, enviamos um novo link/),
      )
      .toBeVisible()
    await expect.element(screen.getByRole('button', { name: 'Reenviar em 60 s' })).toBeVisible()
    await expect
      .element(screen.getByRole('link', { name: 'Entrar' }))
      .toHaveAttribute('href', '/login')
    expect(resent).toEqual([{ email: EMAIL }])
  })

  it('treats a link with no token as one that no longer works, without calling the API', async () => {
    const { screen, sent } = await openLink({}, '/verify-email')
    await expect
      .element(screen.getByRole('heading', { name: 'Este link não vale mais' }))
      .toBeVisible()
    expect(sent).toEqual([])
  })

  it('pauses after too many invalid links, saying for how long', async () => {
    const { screen } = await openLink({
      [VERIFY]: () => apiError('TOO_MANY_ATTEMPTS', 429, { 'Retry-After': '2400' }),
    })
    await expect.element(screen.getByRole('heading', { name: 'Vamos dar uma pausa' })).toBeVisible()
    await expect.poll(momentBackground).toBe(backgroundOfClass('bg-sketch-paper'))
    await expect
      .element(
        screen.getByText(
          'Muitas tentativas com links por aqui. Tente de novo em 40 minutos. Se você já confirmou, é só entrar.',
        ),
      )
      .toBeVisible()
    await expect
      .element(screen.getByRole('link', { name: 'Entrar' }))
      .toHaveAttribute('href', '/login')
    await expectNoAccessibilityViolations(screen.container)
  })

  it('keeps the confirming screen on an unexpected failure, with the ref above "Tentar de novo"', async () => {
    const answers = [apiError('INTERNAL_ERROR', 500), NO_CONTENT()]
    const { screen, sent } = await openLink({
      [VERIFY]: () => answers.shift() ?? NO_CONTENT(),
    })

    await expect
      .element(screen.getByRole('alert'))
      .toHaveTextContent('Algo deu errado. Tente de novo; se continuar, informe o código abcd1234.')
    await expect
      .element(screen.getByRole('heading', { name: 'Confirmando seu e-mail' }))
      .toBeVisible()
    const alert = screen.getByRole('alert').element()
    const retry = screen.getByRole('button', { name: 'Tentar de novo' }).element()
    expect(alert.compareDocumentPosition(retry) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await expectNoAccessibilityViolations(screen.container)

    await screen.getByRole('button', { name: 'Tentar de novo' }).click()
    await expect.element(screen.getByRole('heading', { name: 'E-mail confirmado!' })).toBeVisible()
    expect(sent).toEqual([{ token: TOKEN }, { token: TOKEN }])
  })

  it('says the connection failed when the API cannot be reached', async () => {
    const { screen } = await openLink({
      [VERIFY]: () => Promise.reject(new TypeError('Failed to fetch')),
    })
    await expect
      .element(screen.getByRole('alert'))
      .toHaveTextContent('Sem conexão. Verifique a internet e tente de novo.')
    await expect.element(screen.getByRole('button', { name: 'Tentar de novo' })).toBeVisible()
  })
})
