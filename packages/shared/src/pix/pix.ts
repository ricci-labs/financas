import type { PixCharge } from '@shared/pix/pix.types'

const GUI = 'br.gov.bcb.pix'
const CURRENCY_BRL = '986'
const COUNTRY = 'BR'
const MERCHANT_CATEGORY_UNKNOWN = '0000'
const FORMAT_VERSION = '01'
const MAX_NAME_LENGTH = 25
const MAX_CITY_LENGTH = 15
const MAX_TXID_LENGTH = 25
const CRC_POLYNOMIAL = 0x1021
const CRC_START = 0xffff
const CRC_FIELD_PREFIX = '6304'
const CENTS_PER_REAL = 100

export function pixCopiaECola(charge: PixCharge): string {
  const merchantAccount = field('00', GUI) + field('01', charge.key)
  const payload = [
    field('00', FORMAT_VERSION),
    field('26', merchantAccount),
    field('52', MERCHANT_CATEGORY_UNKNOWN),
    field('53', CURRENCY_BRL),
    field('54', (charge.amountCents / CENTS_PER_REAL).toFixed(2)),
    field('58', COUNTRY),
    field('59', plain(charge.receiverName, MAX_NAME_LENGTH)),
    field('60', plain(charge.receiverCity, MAX_CITY_LENGTH)),
    field('62', field('05', txidOf(charge.txid))),
    CRC_FIELD_PREFIX,
  ].join('')
  return payload + crc16(payload)
}

export function crc16(text: string): string {
  let crc = CRC_START
  for (const byte of new TextEncoder().encode(text)) {
    crc ^= byte << 8
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? (crc << 1) ^ CRC_POLYNOMIAL : crc << 1
      crc &= 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

function field(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, '0')}${value}`
}

function plain(text: string, maxLength: number): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .trim()
    .slice(0, maxLength)
}

function txidOf(txid: string): string {
  const cleaned = txid.replace(/[^A-Za-z0-9]/g, '').slice(0, MAX_TXID_LENGTH)
  return cleaned || '***'
}
