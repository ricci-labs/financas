import type { Cents } from '@shared/money/money.types'

const CURRENCY_PREFIX = /^R\$\s*/i
const WHITESPACE = /\s/g
const DOTS = /\./g
const BRAZILIAN_THOUSANDS_ONLY = /^\d{1,3}(\.\d{3})+$/
const DECIMAL_AMOUNT = /^(\d+)(?:\.(\d{1,2}))?$/
const CENTS_PER_REAL = 100

const brlFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function assertCents(value: number, label = 'amount'): asserts value is Cents {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be integer cents: ${value}`)
  }
}

export function assertPositiveCents(value: number, label = 'amount'): asserts value is Cents {
  assertCents(value, label)
  if (value <= 0) {
    throw new RangeError(`${label} must be positive: ${value}`)
  }
}

export function parseBrl(input: string): Cents {
  const normalized = toDecimalNotation(input)
  const match = DECIMAL_AMOUNT.exec(normalized)
  if (!match) {
    throw new RangeError(`Invalid amount: ${input}`)
  }

  const reais = Number(match[1])
  const centavos = Number((match[2] ?? '').padEnd(2, '0'))
  const cents = reais * CENTS_PER_REAL + centavos
  assertCents(cents)
  return cents
}

export function formatBrl(cents: Cents): string {
  assertCents(cents)
  return brlFormatter.format(cents / CENTS_PER_REAL)
}

export function sumCents(values: readonly Cents[]): Cents {
  const total = values.reduce((sum, value) => {
    assertCents(value)
    return sum + value
  }, 0)
  assertCents(total, 'sum')
  return total
}

function toDecimalNotation(input: string): string {
  const text = input.trim().replace(CURRENCY_PREFIX, '').replace(WHITESPACE, '')
  if (text === '') {
    throw new RangeError('Empty amount')
  }

  const usesDecimalComma = text.includes(',')
  if (usesDecimalComma) {
    return text.replace(DOTS, '').replace(',', '.')
  }

  const usesThousandsDots = BRAZILIAN_THOUSANDS_ONLY.test(text)
  if (usesThousandsDots) {
    return text.replace(DOTS, '')
  }

  return text
}
