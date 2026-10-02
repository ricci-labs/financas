import { Button } from '@web/components/actions/button'
import { MomentScreen } from '@web/components/layout/moment-screen/moment-screen'
import { expectNoAccessibilityViolations } from '@web/testing/accessibility'
import { backgroundOfClass } from '@web/testing/colors'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'

describe('MomentScreen', () => {
  it('shows an achievement in mint and a warning in cream, with the actions last', async () => {
    const screen = await render(
      <div>
        <MomentScreen
          tone="celebrate"
          scene="confirmed"
          title="E-mail confirmado!"
          actions={<Button>Entrar</Button>}
        >
          <p>Agora é só entrar.</p>
        </MomentScreen>
        <MomentScreen tone="calm" scene="linkExpired" title="Este link não vale mais">
          <p>Já foi usado ou expirou.</p>
        </MomentScreen>
      </div>,
    )
    const moments = [...screen.container.querySelectorAll('[data-slot=moment-screen]')]
    expect(moments.map((moment) => moment.getAttribute('data-tone'))).toEqual(['celebrate', 'calm'])
    expect(moments.map((moment) => getComputedStyle(moment).backgroundColor)).toEqual([
      backgroundOfClass('bg-mint'),
      backgroundOfClass('bg-sketch-paper'),
    ])
    await expect.element(screen.getByRole('heading', { name: 'E-mail confirmado!' })).toBeVisible()
    await expect.element(screen.getByRole('button', { name: 'Entrar' })).toBeVisible()
  })

  it('has no accessibility violations in either tone', async () => {
    const screen = await render(
      <MomentScreen
        tone="calm"
        scene="closed"
        title="O cadastro está fechado"
        actions={<Button>Ir para o login</Button>}
      >
        <p>Peça um convite a quem usa o Twise.</p>
      </MomentScreen>,
    )
    await expectNoAccessibilityViolations(screen.container)
  })
})
