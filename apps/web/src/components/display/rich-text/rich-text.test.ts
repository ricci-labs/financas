import { partsOf } from '@web/components/display/rich-text/rich-text'
import { describe, expect, it } from 'vitest'

describe('partsOf', () => {
  it('fills the values and marks the bold parts', () => {
    expect(
      partsOf('Enviamos um e-mail para **{email}**. Toque em **Confirmar e-mail**.', {
        email: 'member.a@exemplo.com',
      }),
    ).toEqual([
      { position: 0, text: 'Enviamos um e-mail para ', isStrong: false },
      { position: 1, text: 'member.a@exemplo.com', isStrong: true },
      { position: 2, text: '. Toque em ', isStrong: false },
      { position: 3, text: 'Confirmar e-mail', isStrong: true },
      { position: 4, text: '.', isStrong: false },
    ])
  })

  it('leaves text without markers as one plain part', () => {
    expect(partsOf('Para {name}.', { name: 'Member A' })).toEqual([
      { position: 0, text: 'Para Member A.', isStrong: false },
    ])
  })
})
