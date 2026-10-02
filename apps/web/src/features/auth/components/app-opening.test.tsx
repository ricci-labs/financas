import { createMemoryHistory } from '@tanstack/react-router'
import { AppProviders } from '@web/app/providers'
import { createApp } from '@web/app/router'
import { expectNoAccessibilityViolations } from '@web/testing/accessibility'
import { account, fakeApi, sessionRequired } from '@web/testing/fake-api'
import type { FakeAnswer } from '@web/testing/testing.types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'

const ME = 'GET /api/auth/me'
const SLOW_MS = 1500
const UNDER_SLOW_MS = 1000
const APP_AND_LOG_IN_CHECKS = 2

async function openApp(me: FakeAnswer) {
  const calls = { me: 0 }
  fakeApi({
    [ME]: (request) => {
      calls.me += 1
      return me(request)
    },
    'GET /api/auth/config': () => Response.json({ isSignupEnabled: false }),
    'GET /api/health/ready': () => Response.json({ status: 'ready', version: 'dev' }),
  })
  const app = createApp(createMemoryHistory({ initialEntries: ['/'] }))
  const screen = await render(<AppProviders app={app} />)
  return { app, screen, calls }
}

function splash() {
  return document.querySelector('[data-slot=app-splash]')
}

describe('SHELL-01 app opening', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the opening at once, says "Abrindo…" only after 1.5 s, then opens the app', async () => {
    let answer: (response: Response) => void = () => undefined
    const { app, screen } = await openApp(() => new Promise((resolve) => (answer = resolve)))

    await expect.poll(splash).not.toBeNull()
    await expect.element(screen.getByText('twise')).toBeVisible()
    await new Promise((resolve) => setTimeout(resolve, UNDER_SLOW_MS))
    await expect.element(screen.getByText('Abrindo…')).not.toBeInTheDocument()
    await expect.element(screen.getByText('Abrindo…'), { timeout: SLOW_MS }).toBeVisible()
    await expectNoAccessibilityViolations(screen.container)

    answer(account())
    await expect.poll(splash).toBeNull()
    expect(app.router.state.location.pathname).toBe('/')
  })

  it('opens the log in when there is no session', async () => {
    const { app, screen } = await openApp(sessionRequired)
    await expect.element(screen.getByRole('heading', { name: 'Entrar no Twise' })).toBeVisible()
    expect(splash()).toBeNull()
    expect(app.router.state.location.pathname).toBe('/login')
  })

  it('opens the log in at once when the API cannot be reached, with no retries', async () => {
    const { screen, calls } = await openApp(() => Promise.reject(new TypeError('Failed to fetch')))
    await expect.element(screen.getByRole('heading', { name: 'Entrar no Twise' })).toBeVisible()
    expect(calls.me).toBe(APP_AND_LOG_IN_CHECKS)
  })
})
