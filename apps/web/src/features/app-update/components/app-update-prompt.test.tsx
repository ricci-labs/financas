import { Toaster } from '@web/components/feedback/toast'
import { AppUpdatePrompt } from '@web/features/app-update/components/app-update-prompt'
import { expectNoAccessibilityViolations } from '@web/testing/accessibility'
import { describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'

const worker = vi.hoisted(() => ({ needRefresh: false, update: vi.fn() }))

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [worker.needRefresh, () => undefined],
    offlineReady: [false, () => undefined],
    updateServiceWorker: worker.update,
  }),
}))

describe('AppUpdatePrompt', () => {
  it('says nothing while the running version is the latest', async () => {
    worker.needRefresh = false
    await render(
      <>
        <AppUpdatePrompt />
        <Toaster />
      </>,
    )
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(document.querySelector('[data-slot=toast]')).toBeNull()
  })

  it('offers the new version and reloads into it on "Atualizar"', async () => {
    worker.needRefresh = true
    const screen = await render(
      <>
        <AppUpdatePrompt />
        <Toaster />
      </>,
    )
    await expect.element(page.getByText('Nova versão disponível')).toBeVisible()
    await expectNoAccessibilityViolations(screen.container.ownerDocument.body)
    await page.getByRole('button', { name: 'Atualizar' }).click()
    expect(worker.update).toHaveBeenCalledWith(true)
  })
})
