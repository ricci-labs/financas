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
    await render(<AppUpdatePrompt />)
    expect(document.querySelector('[data-slot=app-update]')).toBeNull()
  })

  it('offers the new version in a strip fixed on top, until "Atualizar" reloads into it', async () => {
    worker.needRefresh = true
    const screen = await render(<AppUpdatePrompt />)
    await expect.element(page.getByText('Nova versão disponível')).toBeVisible()
    const strip = document.querySelector('[data-slot=app-update]') as HTMLElement
    expect(getComputedStyle(strip).position).toBe('fixed')
    expect(strip.getBoundingClientRect().top).toBe(0)
    await expectNoAccessibilityViolations(screen.container)

    await page.getByRole('button', { name: 'Atualizar' }).click()
    expect(worker.update).toHaveBeenCalledWith(true)
  })
})
