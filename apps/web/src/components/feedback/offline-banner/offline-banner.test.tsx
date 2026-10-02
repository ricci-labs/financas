import { OfflineBanner } from '@web/components/feedback/offline-banner/offline-banner'
import { expectNoAccessibilityViolations } from '@web/testing/accessibility'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'

const OFFLINE_TEXT = 'Sem conexão. Verifique a internet e tente de novo.'

function goOffline(isOffline: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(!isOffline)
  window.dispatchEvent(new Event(isOffline ? 'offline' : 'online'))
}

describe('OfflineBanner', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    window.dispatchEvent(new Event('online'))
  })

  it('appears while the device is offline and leaves when the connection is back', async () => {
    const screen = await render(<OfflineBanner />)
    await expect.element(screen.getByText(OFFLINE_TEXT)).not.toBeInTheDocument()

    goOffline(true)
    await expect.element(screen.getByRole('status')).toHaveTextContent(OFFLINE_TEXT)
    await expectNoAccessibilityViolations(screen.container)

    goOffline(false)
    await expect.element(screen.getByText(OFFLINE_TEXT)).not.toBeInTheDocument()
  })
})
