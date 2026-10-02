import { readFileSync, writeFileSync } from 'node:fs'
import { readThemeValues, resolveColor } from './tokens/semantic-tokens.mjs'

const OUTPUT_FILE = 'apps/api/src/core/email/brand-colors.gen.ts'
const CHECK_FLAG = '--check'
const EMAIL_THEME = 'light'
const EMAIL_ROLES = [
  ['page', 'bg-page'],
  ['surface', 'bg-surface'],
  ['ink', 'ink'],
  ['inkMuted', 'ink-muted'],
  ['inkSubtle', 'ink-subtle'],
  ['border', 'border'],
  ['mint', 'mint'],
  ['mintInk', 'mint-ink'],
  ['actionPrimary', 'action-primary'],
  ['onActionPrimary', 'on-action-primary'],
]

function generatedSource() {
  const values = readThemeValues()[EMAIL_THEME]
  const entries = EMAIL_ROLES.map(
    ([key, role]) => `  ${key}: '${resolveColor(values, role)}',`,
  ).join('\n')
  return `export const BRAND_COLORS = {\n${entries}\n} as const\n`
}

function currentSource() {
  try {
    return readFileSync(OUTPUT_FILE, 'utf8')
  } catch {
    return ''
  }
}

const source = generatedSource()
if (process.argv.includes(CHECK_FLAG)) {
  if (currentSource() !== source) {
    console.error(`${OUTPUT_FILE} is out of date with the tokens. Run pnpm gen:email-colors.`)
    process.exit(1)
  }
  console.log('Email brand colours match the design tokens.')
} else {
  writeFileSync(OUTPUT_FILE, source)
  console.log(`Wrote ${OUTPUT_FILE} from the light theme tokens.`)
}
