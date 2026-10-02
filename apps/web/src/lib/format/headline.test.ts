import { headlineOf } from '@web/lib/format/headline'
import { describe, expect, it } from 'vitest'

describe('headlineOf', () => {
  it('makes the first sentence the title and keeps the rest as the text', () => {
    expect(headlineOf('Sem conexão. Verifique a internet e tente de novo.')).toEqual({
      title: 'Sem conexão',
      text: 'Verifique a internet e tente de novo.',
    })
  })

  it('keeps a single sentence whole, as the title', () => {
    expect(headlineOf('Este convite foi cancelado.')).toEqual({
      title: 'Este convite foi cancelado.',
      text: '',
    })
  })
})
