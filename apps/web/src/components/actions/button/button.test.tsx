import { Button } from '@web/components/actions/button/button'
import { expectNoAccessibilityViolations } from '@web/testing/accessibility'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'

const MS_PER_SECOND = 1000
const SECONDS_TO_WAIT = 3

describe('Button', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('runs its action when pressed', async () => {
    const onClick = vi.fn()
    const screen = await render(<Button onClick={onClick}>Salvar conta</Button>)

    await screen.getByRole('button', { name: 'Salvar conta' }).click()

    expect(onClick).toHaveBeenCalledOnce()
  })

  it('stays focusable while disabled and reports the press instead of acting', async () => {
    const onClick = vi.fn()
    const onDisabledPress = vi.fn()
    const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault())
    const screen = await render(
      <form onSubmit={(event) => onSubmit(event.nativeEvent as SubmitEvent)}>
        <Button type="submit" isDisabled onClick={onClick} onDisabledPress={onDisabledPress}>
          Entrar
        </Button>
      </form>,
    )
    const button = screen.getByRole('button', { name: 'Entrar' })

    await expect.element(button).toHaveAttribute('aria-disabled', 'true')
    await button.click({ force: true })

    expect(onDisabledPress).toHaveBeenCalledOnce()
    expect(onClick).not.toHaveBeenCalled()
    expect(onSubmit).not.toHaveBeenCalled()
    ;(button.element() as HTMLButtonElement).focus()
    expect(document.activeElement).toBe(button.element())
  })

  it('shows a spinner and the gerund label while loading, and sends nothing', async () => {
    const onClick = vi.fn()
    const screen = await render(
      <Button isLoading loadingLabel="Entrando…" onClick={onClick}>
        Entrar
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Entrando…' })

    await expect.element(button).toHaveAttribute('aria-busy', 'true')
    await button.click({ force: true })
    expect(onClick).not.toHaveBeenCalled()
  })

  it('counts down while it must wait, then releases itself', async () => {
    const onClick = vi.fn()
    const screen = await render(
      <Button
        waitUntil={Date.now() + SECONDS_TO_WAIT * MS_PER_SECOND}
        waitLabel={(seconds) => `Reenviar em ${seconds} s`}
        onClick={onClick}
      >
        Reenviar e-mail
      </Button>,
    )

    await expect.element(screen.getByRole('button', { name: 'Reenviar em 3 s' })).toBeVisible()
    await screen.getByRole('button').click({ force: true })
    expect(onClick).not.toHaveBeenCalled()

    await expect
      .element(screen.getByRole('button', { name: 'Reenviar e-mail' }), { timeout: 5000 })
      .toBeVisible()
    await screen.getByRole('button').click()
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('has no accessibility violations in any state', async () => {
    const screen = await render(
      <div>
        <Button>Salvar conta</Button>
        <Button variant="outline">Já tenho conta</Button>
        <Button variant="tertiary">Esqueci minha senha</Button>
        <Button isDisabled>Entrar</Button>
        <Button isLoading loadingLabel="Entrando…">
          Entrar
        </Button>
      </div>,
    )
    await expectNoAccessibilityViolations(screen.container)
  })
})
