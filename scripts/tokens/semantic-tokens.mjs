import { readFileSync } from 'node:fs'

export const SEMANTIC_TOKENS_FILE = 'apps/web/src/styles/tokens/semantic.css'

const BLOCK = /(:root|\.dark)\s*\{([^}]*)\}/g
const DECLARATION = /--([a-z0-9-]+)\s*:\s*([^;]+);/g
const VARIABLE_REFERENCE = /^var\(--([a-z0-9-]+)\)$/
const HEX_COLOR = /^#[0-9a-f]{6}$/i

function declarationsOf(css, selector) {
  const declarations = {}
  for (const [, blockSelector, body] of css.matchAll(BLOCK)) {
    if (blockSelector === selector) {
      for (const [, name, value] of body.matchAll(DECLARATION)) {
        declarations[name] = value.trim()
      }
    }
  }
  return declarations
}

export function readThemeValues(file = SEMANTIC_TOKENS_FILE) {
  const css = readFileSync(file, 'utf8')
  const light = declarationsOf(css, ':root')
  return { light, dark: { ...light, ...declarationsOf(css, '.dark') } }
}

export function resolveColor(values, name, seen = new Set()) {
  if (seen.has(name) || !(name in values)) {
    throw new Error(`--${name} is not defined, or refers to itself`)
  }
  const value = values[name]
  const reference = value.match(VARIABLE_REFERENCE)
  if (reference) {
    return resolveColor(values, reference[1], new Set([...seen, name]))
  }
  if (!HEX_COLOR.test(value)) {
    throw new Error(`--${name} must resolve to a #rrggbb colour, found "${value}"`)
  }
  return value.toLowerCase()
}
