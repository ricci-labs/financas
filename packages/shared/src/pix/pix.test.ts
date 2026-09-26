import { crc16, pixCopiaECola } from '@shared/pix/pix'
import { describe, expect, it } from 'vitest'

describe('crc16', () => {
  it('matches the CRC-16/CCITT-FALSE check value', () => {
    expect(crc16('123456789')).toBe('29B1')
  })
})

describe('pixCopiaECola', () => {
  const payload = pixCopiaECola({
    key: 'household@example.test',
    receiverName: 'Família São João da Silva Ltda',
    receiverCity: 'São Paulo',
    amountCents: 12_345,
    txid: 'cobranca-01',
  })

  it('writes the EMV fields of a static Pix with amount', () => {
    expect(payload.startsWith('000201')).toBe(true)
    expect(payload).toContain('26440014br.gov.bcb.pix0122household@example.test')
    expect(payload).toContain('5204000053039865406123.455802BR')
    expect(payload).toContain('5925Familia Sao Joao da Silva')
    expect(payload).toContain('6009Sao Paulo')
    expect(payload).toContain('62140510cobranca01')
  })

  it('closes with the CRC of everything before it', () => {
    const body = payload.slice(0, -4)
    expect(body.endsWith('6304')).toBe(true)
    expect(payload.slice(-4)).toBe(crc16(body))
  })

  it('uses *** as the transaction id when none is left', () => {
    const anonymous = pixCopiaECola({
      key: 'k',
      receiverName: 'A',
      receiverCity: 'B',
      amountCents: 100,
      txid: '---',
    })
    expect(anonymous).toContain('62070503***')
  })
})
