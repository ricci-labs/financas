import { createMemoryHistory } from '@tanstack/react-router'
import { AppProviders } from '@web/app/providers'
import { createApp } from '@web/app/router'
import { expectNoAccessibilityViolations } from '@web/testing/accessibility'
import { account, apiError, fakeApi, sessionRequired } from '@web/testing/fake-api'
import { fieldLabelled } from '@web/testing/fields'
import type { FakeAnswer } from '@web/testing/testing.types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'

const TOKEN = 'invite-token-123'
const INVITED = 'member.a@exemplo.com'
const PASSWORD = 'café com pão de queijo'
const PREVIEW = 'POST /api/invitations/preview'
const ACCEPT = 'POST /api/invitations/accept'
const SIGN_UP = 'POST /api/invitations/sign-up'
const JOINED = { workspaceId: 'workspace-1', membershipId: 'membership-1' }

function preview(overrides: Record<string, unknown> = {}) {
  return () =>
    Response.json({
      workspaceName: 'Casa',
      inviterName: 'Member B',
      roleName: 'Membro',
      email: INVITED,
      isPhoneInvitation: false,
      expiresAt: '2026-10-12T15:00:00.000Z',
      ...overrides,
    })
}

function recorded() {
  const bodies: Record<string, unknown[]> = {}
  const record =
    (key: string, answer: FakeAnswer): FakeAnswer =>
    async (request) => {
      bodies[key] = [
        ...(bodies[key] ?? []),
        await request
          .clone()
          .json()
          .catch(() => null),
      ]
      return answer(request)
    }
  return { bodies, record }
}

async function openInvite(
  answers: Record<string, FakeAnswer>,
  { isLoggedIn = false, path = `/invite#token=${TOKEN}` } = {},
) {
  const session = { isLoggedIn }
  const { bodies, record } = recorded()
  fakeApi({
    'GET /api/auth/me': () => (session.isLoggedIn ? account() : sessionRequired()),
    'GET /api/auth/config': () => Response.json({ isSignupEnabled: false }),
    'GET /api/health/ready': () => Response.json({ status: 'ready', version: 'dev' }),
    'POST /api/auth/login': () => {
      session.isLoggedIn = true
      return Response.json({ userId: 'user-a' })
    },
    'POST /api/auth/logout': () => {
      session.isLoggedIn = false
      return new Response(null, { status: 204 })
    },
    ...Object.fromEntries(
      Object.entries({ [PREVIEW]: preview(), ...answers }).map(([key, answer]) => [
        key,
        record(key, answer),
      ]),
    ),
  })
  const app = createApp(createMemoryHistory({ initialEntries: [path] }))
  const screen = await render(<AppProviders app={app} />)
  return { app, screen, bodies }
}

describe('INV-01 invitation', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows who invited, where, as what and until when, with the token out of the address', async () => {
    const { app, screen, bodies } = await openInvite({})

    await expect
      .element(screen.getByRole('heading', { name: 'Member B convidou você' }))
      .toBeVisible()
    await expect.element(screen.getByText(/^para o espaço Casa como Membro\.$/)).toBeVisible()
    await expect
      .element(screen.getByText(`Convite para ${INVITED} · Vale até 12/10/2026`))
      .toBeVisible()
    await expect.element(screen.getByRole('button', { name: 'Criar conta' })).toBeVisible()
    await expect
      .element(screen.getByRole('link', { name: 'Já tenho conta' }))
      .toHaveAttribute('href', '/login?next=%2Finvite')
    expect(app.router.history.location.hash).toBe('')
    expect(bodies[PREVIEW]).toEqual([{ token: TOKEN }])
    await expectNoAccessibilityViolations(screen.container)
  })

  it('comes back from the log in with the invitation and joins the workspace', async () => {
    const { app, screen, bodies } = await openInvite({ [ACCEPT]: () => Response.json(JOINED) })
    await screen.getByRole('link', { name: 'Já tenho conta' }).click()

    await expect.element(screen.getByRole('heading', { name: 'Entrar no Twise' })).toBeVisible()
    await fieldLabelled('E-mail').fill(INVITED)
    await fieldLabelled('Senha').fill(PASSWORD)
    await screen.getByRole('button', { name: 'Entrar' }).click()

    await expect.element(screen.getByRole('button', { name: 'Entrar no espaço' })).toBeVisible()
    await expect
      .element(screen.getByText(`Você está como ${INVITED}.`, { exact: false }))
      .toBeVisible()
    expect(bodies[PREVIEW]).toEqual([{ token: TOKEN }, { token: TOKEN }])
    await expectNoAccessibilityViolations(screen.container)

    await screen.getByRole('button', { name: 'Entrar no espaço' }).click()
    await expect
      .element(screen.getByRole('heading', { name: 'Vocês estão juntos no Casa!' }))
      .toBeVisible()
    await expect.element(screen.getByText('Abrindo o espaço…')).toBeVisible()
    expect(bodies[ACCEPT]).toEqual([{ token: TOKEN }])
    await expect.poll(() => app.router.state.location.pathname, { timeout: 3000 }).toBe('/')
  })

  it('asks the wrong account to leave, and returns to the invitation after the next log in', async () => {
    const { app, screen } = await openInvite(
      { [ACCEPT]: () => apiError('INVITATION_FOR_ANOTHER_EMAIL', 403) },
      { isLoggedIn: true },
    )
    await screen.getByRole('button', { name: 'Entrar no espaço' }).click()

    await expect
      .element(screen.getByRole('heading', { name: 'Este convite é para outra pessoa' }))
      .toBeVisible()
    await expect
      .element(screen.getByText(`Este convite é para ${INVITED}. Saia e entre com esse e-mail.`))
      .toBeVisible()
    await expectNoAccessibilityViolations(screen.container)

    await screen.getByRole('button', { name: 'Sair e entrar com outro e-mail' }).click()
    await expect.element(screen.getByRole('heading', { name: 'Entrar no Twise' })).toBeVisible()
    expect(app.router.state.location.href).toBe('/login?notice=logged-out&next=%2Finvite')
    expect(app.router.state.location.state.inviteToken).toBe(TOKEN)
  })

  it('opens the workspace of someone who already takes part, with no celebration', async () => {
    const { screen } = await openInvite(
      { [ACCEPT]: () => apiError('ALREADY_MEMBER', 409) },
      { isLoggedIn: true },
    )
    await screen.getByRole('button', { name: 'Entrar no espaço' }).click()
    await expect
      .element(screen.getByRole('heading', { name: 'Você já participa deste espaço' }))
      .toBeVisible()
    await expect.element(screen.getByText('Você e Member B já estão juntos no Casa.')).toBeVisible()
    await expect
      .element(screen.getByRole('link', { name: 'Abrir o espaço' }))
      .toHaveAttribute('href', '/')
  })

  it('turns an expired invitation into a calm notice', async () => {
    const { screen } = await openInvite({ [PREVIEW]: () => apiError('INVITATION_EXPIRED', 409) })
    await expect
      .element(screen.getByRole('heading', { name: 'Este convite expirou' }))
      .toBeVisible()
    await expect
      .element(screen.getByText('Peça um novo a quem convidou. Convites valem por 7 dias.'))
      .toBeVisible()
    await expect
      .element(screen.getByRole('link', { name: 'Ir para o login' }))
      .toHaveAttribute('href', '/login')
    await expectNoAccessibilityViolations(screen.container)
  })

  it('says a link with no token was not found, without calling the API', async () => {
    const { screen, bodies } = await openInvite({}, { path: '/invite' })
    await expect
      .element(screen.getByRole('heading', { name: 'Convite não encontrado' }))
      .toBeVisible()
    expect(bodies[PREVIEW]).toBeUndefined()
  })

  it('creates the account with the invited e-mail locked and opens the log in for it', async () => {
    const { screen, bodies } = await openInvite({
      [SIGN_UP]: () => Response.json({ ...JOINED, isEmailVerified: true }, { status: 201 }),
    })
    await screen.getByRole('button', { name: 'Criar conta' }).click()

    await expect.element(screen.getByRole('heading', { name: 'Criar sua conta' })).toBeVisible()
    await expect.element(screen.getByText('Para entrar no espaço Casa com Member B.')).toBeVisible()
    await expect.element(fieldLabelled('E-mail')).toHaveValue(INVITED)
    await expect.element(fieldLabelled('E-mail')).toHaveAttribute('readonly')
    await expect
      .element(screen.getByText('Convite para este e-mail. Ele não pode ser trocado.'))
      .toBeVisible()
    await expect.element(fieldLabelled('Seu nome')).toHaveFocus()
    await expectNoAccessibilityViolations(screen.container)

    await fieldLabelled('Seu nome').fill('Member A')
    await fieldLabelled('Senha').fill(PASSWORD)
    await screen.getByRole('button', { name: 'Criar conta e entrar no espaço' }).click()

    await expect.element(screen.getByRole('heading', { name: 'Entrar no Twise' })).toBeVisible()
    await expect
      .element(screen.getByText('Conta criada. Entre para abrir o espaço Casa.'))
      .toBeVisible()
    await expect.element(fieldLabelled('E-mail')).toHaveValue(INVITED)
    await expect.element(fieldLabelled('Senha')).toHaveFocus()
    expect(bodies[SIGN_UP]).toEqual([{ token: TOKEN, displayName: 'Member A', password: PASSWORD }])
  })

  it('asks a phone invitation for an e-mail and waits for its confirmation', async () => {
    const { screen, bodies } = await openInvite({
      [PREVIEW]: preview({ email: null, isPhoneInvitation: true }),
      [SIGN_UP]: () => Response.json({ ...JOINED, isEmailVerified: false }, { status: 201 }),
    })
    await expect.element(screen.getByText('Vale até 12/10/2026')).toBeVisible()
    await screen.getByRole('button', { name: 'Criar conta' }).click()

    await expect.element(fieldLabelled('E-mail')).toHaveFocus()
    await fieldLabelled('E-mail').fill('MEMBER.C@exemplo.com')
    await fieldLabelled('Seu nome').fill('Member C')
    await fieldLabelled('Senha').fill(PASSWORD)
    await screen.getByRole('button', { name: 'Criar conta e entrar no espaço' }).click()

    await expect
      .element(screen.getByRole('heading', { name: 'Falta só confirmar o e-mail' }))
      .toBeVisible()
    await expect
      .element(screen.getByRole('listitem').filter({ hasText: 'Confirmar e-mail' }))
      .toHaveAttribute('aria-current', 'step')
    expect(bodies[SIGN_UP]).toEqual([
      { token: TOKEN, displayName: 'Member C', password: PASSWORD, email: 'member.c@exemplo.com' },
    ])
    await expectNoAccessibilityViolations(screen.container)
  })

  it('points an e-mail that already has an account to the log in, keeping the invitation', async () => {
    const { screen } = await openInvite({
      [PREVIEW]: preview({ email: null, isPhoneInvitation: true }),
      [SIGN_UP]: () => apiError('EMAIL_TAKEN', 409),
    })
    await screen.getByRole('button', { name: 'Criar conta' }).click()
    await fieldLabelled('E-mail').fill('member.c@exemplo.com')
    await fieldLabelled('Seu nome').fill('Member C')
    await fieldLabelled('Senha').fill(PASSWORD)
    await screen.getByRole('button', { name: 'Criar conta e entrar no espaço' }).click()

    await expect
      .element(screen.getByRole('alert'))
      .toHaveTextContent(
        'Já existe uma conta com esse e-mail. Entre com ela para aceitar o convite.',
      )
    await expect
      .element(screen.getByRole('link', { name: 'Entre com ela' }))
      .toHaveAttribute('href', '/login?next=%2Finvite')
    await expectNoAccessibilityViolations(screen.container)
  })
})
