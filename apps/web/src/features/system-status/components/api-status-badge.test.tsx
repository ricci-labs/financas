import { ApiStatusBadge } from '@web/features/system-status/components/api-status-badge'
import { expectNoAccessibilityViolations } from '@web/testing/accessibility'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'

const API_VERSION = '1.2.3'

function answerHealthWith(version: string) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ status: 'ready', version }))
}

function failEveryRequest() {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
}

describe('ApiStatusBadge', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the API version once the API answers', async () => {
    answerHealthWith(API_VERSION)

    const screen = await render(<ApiStatusBadge />)

    await expect.element(screen.getByText(`API online · ${API_VERSION}`)).toBeVisible()
  })

  it('says the API is offline when the request fails', async () => {
    failEveryRequest()

    const screen = await render(<ApiStatusBadge />)

    await expect.element(screen.getByText('API offline')).toBeVisible()
  })

  it('has no accessibility violations', async () => {
    answerHealthWith(API_VERSION)

    const screen = await render(<ApiStatusBadge />)

    await expect.element(screen.getByText(`API online · ${API_VERSION}`)).toBeVisible()
    await expectNoAccessibilityViolations(screen.container)
  })
})
