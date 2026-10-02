import { readThemeValues, resolveColor } from './tokens/semantic-tokens.mjs'

const THEMES = ['light', 'dark']
const ACCOUNT_SCREEN_THEME = 'light'
const TEXT_MINIMUM = 4.5
const UI_MINIMUM = 3
const LUMINANCE_OFFSET = 0.05
const LINEAR_THRESHOLD = 0.04045
const LINEAR_DIVISOR = 12.92
const GAMMA_OFFSET = 0.055
const GAMMA_DIVISOR = 1.055
const GAMMA = 2.4
const CHANNEL_MAX = 255
const RED_WEIGHT = 0.2126
const GREEN_WEIGHT = 0.7152
const BLUE_WEIGHT = 0.0722

const SURFACES = ['bg-page', 'bg-surface', 'bg-sunken']
const TEXT_PAIRS = [
  ...SURFACES.flatMap((surface) => [
    ['ink', surface],
    ['ink-muted', surface],
  ]),
  ['ink-subtle', 'bg-page'],
  ['ink-subtle', 'bg-surface'],
  ['on-mint', 'mint'],
  ['mint-ink', 'bg-page'],
  ['mint-ink', 'bg-surface'],
  ['on-action-primary', 'action-primary'],
  ['on-action-primary', 'action-primary-hover'],
  ['ink', 'action-secondary'],
  ['ink', 'action-secondary-hover'],
  ['transfer', 'bg-surface'],
  ...['income', 'expense', 'success', 'warning', 'danger', 'info'].flatMap((role) => [
    [role, 'bg-surface'],
    [role, 'bg-page'],
    [role, `${role}-soft`],
  ]),
  ...['pending', 'overdue', 'paid', 'partial', 'neutral', 'matched'].map((status) => [
    `status-${status}`,
    `status-${status}-soft`,
  ]),
  ['ink', 'mint-soft'],
  ['sketch-ink', 'sketch-paper'],
]
const ACCOUNT_SCREEN_TEXT_PAIRS = [
  ['ink', 'sketch-paper'],
  ['ink-muted', 'sketch-paper'],
  ['on-mint', 'mint-soft'],
]
const UI_PAIRS = [
  ['border-control', 'bg-page'],
  ['border-control', 'bg-surface'],
  ['focus-ring', 'bg-page'],
  ['focus-ring', 'bg-surface'],
  ...['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'].map((series) => [
    series,
    'bg-surface',
  ]),
]
const ACCOUNT_SCREEN_UI_PAIRS = [['focus-ring', 'mint']]

function linearChannel(channel) {
  const ratio = channel / CHANNEL_MAX
  return ratio <= LINEAR_THRESHOLD
    ? ratio / LINEAR_DIVISOR
    : ((ratio + GAMMA_OFFSET) / GAMMA_DIVISOR) ** GAMMA
}

function relativeLuminance(hex) {
  const [red, green, blue] = [1, 3, 5].map((start) =>
    linearChannel(Number.parseInt(hex.slice(start, start + 2), 16)),
  )
  return RED_WEIGHT * red + GREEN_WEIGHT * green + BLUE_WEIGHT * blue
}

function contrastRatio(foreground, background) {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort(
    (first, second) => second - first,
  )
  return (lighter + LUMINANCE_OFFSET) / (darker + LUMINANCE_OFFSET)
}

function pairProblems(values, theme, pairs, minimum) {
  return pairs.flatMap(([foreground, background]) => {
    const ratio = contrastRatio(resolveColor(values, foreground), resolveColor(values, background))
    if (ratio >= minimum) {
      return []
    }
    return [`${theme}: ${foreground} on ${background} is ${ratio.toFixed(2)}:1, needs ${minimum}:1`]
  })
}

const valuesByTheme = readThemeValues()
const accountScreenValues = valuesByTheme[ACCOUNT_SCREEN_THEME]
const problems = [
  ...THEMES.flatMap((theme) => [
    ...pairProblems(valuesByTheme[theme], theme, TEXT_PAIRS, TEXT_MINIMUM),
    ...pairProblems(valuesByTheme[theme], theme, UI_PAIRS, UI_MINIMUM),
  ]),
  ...pairProblems(accountScreenValues, 'account screens', ACCOUNT_SCREEN_TEXT_PAIRS, TEXT_MINIMUM),
  ...pairProblems(accountScreenValues, 'account screens', ACCOUNT_SCREEN_UI_PAIRS, UI_MINIMUM),
]
const pairCount =
  (TEXT_PAIRS.length + UI_PAIRS.length) * THEMES.length +
  ACCOUNT_SCREEN_TEXT_PAIRS.length +
  ACCOUNT_SCREEN_UI_PAIRS.length

if (problems.length > 0) {
  console.error('Token pairs below WCAG 2.2 AA (1.4.3 text, 1.4.11 UI parts):')
  for (const problem of problems) {
    console.error(`  ${problem}`)
  }
  process.exit(1)
}

console.log(
  `Contrast meets WCAG 2.2 AA for ${pairCount} token pairs (both themes, account screens light).`,
)
