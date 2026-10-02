import { StepTrack } from '@web/components/display/step-track/step-track'
import { expectNoAccessibilityViolations } from '@web/testing/accessibility'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'

const STEPS = ['Conta criada', 'Confirmar e-mail', 'Entrar']

describe('StepTrack', () => {
  it('is an ordered list that marks the current step', async () => {
    const screen = await render(<StepTrack label="Seu cadastro" steps={STEPS} currentStep={1} />)

    await expect.element(screen.getByRole('list', { name: 'Seu cadastro' })).toBeVisible()
    const items = screen.getByRole('listitem').elements()
    expect(items.map((item) => item.getAttribute('aria-current'))).toEqual([null, 'step', null])
    expect(items.map((item) => item.textContent)).toEqual([
      'Conta criada',
      '2Confirmar e-mail',
      '3Entrar',
    ])
  })

  it('shows a check on done steps and a spinner on the current one while it loads', async () => {
    const screen = await render(
      <StepTrack label="Seu cadastro" steps={STEPS} currentStep={1} isCurrentLoading />,
    )
    const [done, current] = screen.getByRole('listitem').elements()
    expect(done?.querySelector('svg')).not.toBeNull()
    expect(current?.querySelector('.animate-spin')).not.toBeNull()
    await expectNoAccessibilityViolations(screen.container)
  })
})
