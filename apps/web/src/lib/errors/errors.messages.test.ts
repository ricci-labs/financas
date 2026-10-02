import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  errorMessages,
  NETWORK_ERROR_MESSAGE,
  UNKNOWN_ERROR_MESSAGE,
} from '@web/lib/errors/errors.messages'
import { describe, expect, it } from 'vitest'

const CATALOG = resolve(process.cwd(), '../../docs/product/requirements/error-messages.md')
const CODE = /`([A-Z_]+)`/g
const QUOTED = /"([^"]+)"/g
const ALIAS_ROW = 'same messages as'

function codesIn(text: string): string[] {
  return [...text.matchAll(CODE)].flatMap(([, code]) => (code ? [code] : []))
}

function catalogRows() {
  return readFileSync(CATALOG, 'utf8')
    .split('\n')
    .filter((line) => line.startsWith('| `') || line.startsWith('| ('))
    .map((line) => line.split('|').map((cell) => cell.trim()))
    .map(([, first = '', , , message = '']) => ({
      codes: codesIn(first),
      label: first,
      message,
      quoted: [...message.matchAll(QUOTED)].flatMap(([, text]) => (text ? [text] : [])),
    }))
}

function expectedMessages(): Map<string, string> {
  const expected = new Map<string, string>()
  for (const row of catalogRows().filter((entry) => entry.codes.length > 0)) {
    if (row.message.startsWith(ALIAS_ROW)) {
      const sources = codesIn(row.message)
      row.codes.forEach((code, index) => {
        expected.set(code, `alias:${sources[index] ?? ''}`)
      })
      expected.set(row.codes.at(-1) ?? '', row.quoted[0] ?? '')
      continue
    }
    for (const code of row.codes) {
      expected.set(code, row.quoted[0] ?? UNKNOWN_ERROR_MESSAGE)
    }
  }
  return expected
}

function resolveAlias(expected: Map<string, string>, message: string): string {
  return message.startsWith('alias:')
    ? (expected.get(message.slice('alias:'.length)) ?? '')
    : message
}

describe('errorMessages', () => {
  it('has the message of error-messages.md for every code it lists', () => {
    const expected = expectedMessages()
    for (const [code, message] of expected) {
      expect(errorMessages[code], code).toBe(resolveAlias(expected, message))
    }
  })

  it('lists no code the catalog lacks', () => {
    const expected = expectedMessages()
    expect(Object.keys(errorMessages).filter((code) => !expected.has(code))).toEqual([])
  })

  it('uses the catalog messages for a network failure and an unknown code', () => {
    const special = new Map(catalogRows().map((row) => [row.label, row.quoted[0]]))
    expect(NETWORK_ERROR_MESSAGE).toBe(special.get('(network)'))
    expect(UNKNOWN_ERROR_MESSAGE).toBe(special.get('(unknown code)'))
  })
})
