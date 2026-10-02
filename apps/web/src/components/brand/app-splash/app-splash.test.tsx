import { AppSplash } from '@web/components/brand/app-splash/app-splash'
import { expectNoAccessibilityViolations } from '@web/testing/accessibility'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'

describe('AppSplash', () => {
  it('shows the brand while the app opens, and "Abrindo…" only when it is slow', async () => {
    const screen = await render(<AppSplash isSlow={false} />)
    await expect.element(screen.getByText('twise')).toBeVisible()
    await expect.element(screen.getByText('Leve, claro, a dois.')).toBeVisible()
    await expect.element(screen.getByText('Abrindo…')).not.toBeInTheDocument()

    await screen.rerender(<AppSplash isSlow />)
    await expect.element(screen.getByRole('status')).toHaveTextContent('Abrindo…')
    await expectNoAccessibilityViolations(screen.container)
  })
})
