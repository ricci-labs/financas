import { showToast, Toaster } from '@web/components/feedback/toast/toast'
import { expectNoAccessibilityViolations } from '@web/testing/accessibility'
import { describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'

describe('Toast', () => {
  it('shows a short confirmation', async () => {
    await render(<Toaster />)
    showToast('Enviamos de novo.')
    await expect.element(page.getByText('Enviamos de novo.')).toBeVisible()
    await expectNoAccessibilityViolations(document.body)
  })

  it('runs its action once and closes', async () => {
    const onPress = vi.fn()
    await render(<Toaster />)
    showToast('Lançamento movido para a lixeira.', { action: { label: 'Desfazer', onPress } })

    await page.getByRole('button', { name: 'Desfazer' }).click()

    expect(onPress).toHaveBeenCalledOnce()
    await expect
      .element(page.getByText('Lançamento movido para a lixeira.'))
      .not.toBeInTheDocument()
  })
})
