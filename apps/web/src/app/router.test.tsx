import { createMemoryHistory } from '@tanstack/react-router'
import { AppProviders } from '@web/app/providers'
import { createApp } from '@web/app/router'
import { expectNoAccessibilityViolations } from '@web/testing/accessibility'
import { account, fakeApi, sessionRequired } from '@web/testing/fake-api'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'

const ME = '/api/auth/me'
const HEALTH = '/api/health/ready'
const LOGIN_TITLE = 'Entrar no Twise'

async function startAt(path: string) {
  const app = createApp(createMemoryHistory({ initialEntries: [path] }))
  const screen = await render(<AppProviders app={app} />)
  return { app, screen }
}

function healthy(): Response {
  return Response.json({ status: 'ready', version: 'dev' })
}

describe('app router', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sends a visitor without a session to log in, remembering where they were going', async () => {
    fakeApi({ [ME]: sessionRequired })
    const { app, screen } = await startAt('/')

    await expect.element(screen.getByRole('heading', { name: LOGIN_TITLE })).toBeVisible()
    expect(app.router.state.location.pathname).toBe('/login')
    expect(app.router.state.location.search).toEqual({ next: '/' })
  })

  it('opens the app for someone with a session', async () => {
    fakeApi({ [ME]: account, [HEALTH]: healthy })
    const { screen } = await startAt('/')

    await expect.element(screen.getByRole('heading', { name: 'Twise' })).toBeVisible()
  })

  it('sends someone already logged in from log in to where they were going', async () => {
    fakeApi({ [ME]: account, [HEALTH]: healthy })
    const { app, screen } = await startAt('/login?next=%2F')

    await expect.element(screen.getByRole('heading', { name: 'Twise' })).toBeVisible()
    expect(app.router.state.location.pathname).toBe('/')
  })

  it('never follows a next address outside the app', async () => {
    fakeApi({ [ME]: account, [HEALTH]: healthy })
    const { app, screen } = await startAt('/login?next=%2F%2Fevil.test')

    await expect.element(screen.getByRole('heading', { name: 'Twise' })).toBeVisible()
    expect(app.router.state.location.pathname).toBe('/')
  })

  it('returns to log in with the session-ended notice when the session ends', async () => {
    const api = fakeApi({ [ME]: account, [HEALTH]: healthy })
    const { app, screen } = await startAt('/')
    await expect.element(screen.getByRole('heading', { name: 'Twise' })).toBeVisible()

    api.mockImplementation(() => Promise.resolve(sessionRequired()))
    await app.queryClient.refetchQueries()

    await expect.element(screen.getByRole('heading', { name: LOGIN_TITLE })).toBeVisible()
    expect(app.router.state.location.search).toEqual({ next: '/', notice: 'session-ended' })
  })
  it('has no accessibility violations on log in', async () => {
    fakeApi({ [ME]: sessionRequired })
    const { screen } = await startAt('/login')

    await expect.element(screen.getByRole('heading', { name: LOGIN_TITLE })).toBeVisible()
    await expectNoAccessibilityViolations(screen.container)
  })
  it('says when the role lost a permission and reloads the permissions', async () => {
    const api = fakeApi({ [ME]: account, [HEALTH]: healthy })
    const { app, screen } = await startAt('/')
    await expect.element(screen.getByRole('heading', { name: 'Twise' })).toBeVisible()

    api.mockImplementation(() =>
      Promise.resolve(
        Response.json(
          { error: { code: 'PERMISSION_DENIED', message: 'No', ref: 'abcd1234' } },
          { status: 403 },
        ),
      ),
    )
    await app.queryClient.refetchQueries()

    await expect
      .element(
        screen.getByText('Você não tem permissão para isso. Peça a um administrador do espaço.'),
      )
      .toBeVisible()
  })
})
