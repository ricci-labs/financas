import { partsOf } from '@web/components/display/rich-text/rich-text'
import { describe, expect, it } from 'vitest'

describe('partsOf', () => {
  it('fills the values and marks the bold parts', () => {
    expect(
      partsOf('Enviamos um e-mail para **{email}**. Toque em **Confirmar e-mail**.', {
        email: 'member.a@exemplo.com',
      }),
    ).toEqual([
      { position: 0, text: 'Enviamos um e-mail para ', kind: 'plain' },
      { position: 1, text: 'member.a@exemplo.com', kind: 'strong' },
      { position: 2, text: '. Toque em ', kind: 'plain' },
      { position: 3, text: 'Confirmar e-mail', kind: 'strong' },
      { position: 4, text: '.', kind: 'plain' },
    ])
  })

  it('marks the link part', () => {
    expect(partsOf('Já existe uma conta. [Entre com ela] para aceitar.', {})).toEqual([
      { position: 0, text: 'Já existe uma conta. ', kind: 'plain' },
      { position: 1, text: 'Entre com ela', kind: 'link' },
      { position: 2, text: ' para aceitar.', kind: 'plain' },
    ])
  })

  it('never reads markers inside the values', () => {
    expect(partsOf('No **{name}**.', { name: '[Casa] **2**' })).toEqual([
      { position: 0, text: 'No ', kind: 'plain' },
      { position: 1, text: '[Casa] **2**', kind: 'strong' },
      { position: 2, text: '.', kind: 'plain' },
    ])
  })

  it('leaves text without markers as one plain part', () => {
    expect(partsOf('Para {name}.', { name: 'Member A' })).toEqual([
      { position: 0, text: 'Para Member A.', kind: 'plain' },
    ])
  })
})
