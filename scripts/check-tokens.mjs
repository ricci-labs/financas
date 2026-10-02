import {
  lineOf,
  parseWebSource,
  reportAndExit,
  visitNodes,
  webSourceFiles,
} from './web/web-sources.mjs'

const STYLES_FOLDER = 'apps/web/src/styles/'
const STYLE_PROP_FOLDERS = [
  'apps/web/src/components/inputs/color-swatch/',
  'apps/web/src/components/display/category-icon/',
  'apps/web/src/features/workbench/',
]
const RAW_COLOR = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color-mix)\(/i
const DEFAULT_PALETTE_CLASS =
  /-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}(?:\/\d+)?$/
const BLACK_OR_WHITE_CLASS = /-(?:black|white)(?:\/\d+)?$/
const RESET_SCALE_CLASSES = [
  /^text-(?:lg|xl|[2-9]xl)$/,
  /^shadow-(?:2xs|xs|sm|md|lg|xl|2xl)$/,
  /^rounded(?:-[trblse]{1,2})?-(?:xs|2xl|3xl|4xl)$/,
]
const NUMERIC_LAYER_OR_DURATION_CLASS = /^(?:z|duration)-\d+$/
const ARBITRARY_VALUE = /-\[[^\]]*\]|-\([^)]*\)|^\[[a-z-]+:/
const REMOVED_BREAKPOINT_VARIANTS = new Set(['sm', '2xl', 'max-sm', 'max-2xl'])
const ARBITRARY_BREAKPOINT_VARIANT = /^(?:min|max)-\[/
const VARIANT_SEPARATOR = ':'
const IMPORTANT_OR_NEGATIVE_PREFIX = /^[!-]+/

const OPENING_BRACKETS = new Set(['[', '('])
const CLOSING_BRACKETS = new Set([']', ')'])

function depthAfter(character, depth) {
  if (OPENING_BRACKETS.has(character)) {
    return depth + 1
  }
  if (CLOSING_BRACKETS.has(character)) {
    return depth - 1
  }
  return depth
}

function topLevelParts(className) {
  const parts = ['']
  let depth = 0
  for (const character of className) {
    depth = depthAfter(character, depth)
    if (character === VARIANT_SEPARATOR && depth === 0) {
      parts.push('')
    } else {
      parts[parts.length - 1] += character
    }
  }
  return parts
}

function splitVariants(className) {
  const parts = topLevelParts(className)
  const utility = parts.pop().replace(IMPORTANT_OR_NEGATIVE_PREFIX, '')
  return { variants: parts, utility }
}

function utilityProblem(utility) {
  if (ARBITRARY_VALUE.test(utility)) {
    return 'arbitrary value; use a token'
  }
  if (DEFAULT_PALETTE_CLASS.test(utility) || BLACK_OR_WHITE_CLASS.test(utility)) {
    return "Tailwind's default palette is reset; use a colour role"
  }
  if (RESET_SCALE_CLASSES.some((scale) => scale.test(utility))) {
    return 'this step of the scale is reset (Tailwind drops it silently); use a design token'
  }
  if (NUMERIC_LAYER_OR_DURATION_CLASS.test(utility)) {
    return 'numeric layer or duration; use z-sticky/overlay/modal/toast or duration-fast/normal/slow'
  }
  return null
}

function variantProblem(variant) {
  if (REMOVED_BREAKPOINT_VARIANTS.has(variant) || ARBITRARY_BREAKPOINT_VARIANT.test(variant)) {
    return 'breakpoint outside the design (md, lg, xl only)'
  }
  return null
}

function classProblems(className) {
  const { variants, utility } = splitVariants(className)
  return [...variants.map(variantProblem), utilityProblem(utility)].filter(Boolean)
}

function stringProblems(text) {
  const rawColorProblems = RAW_COLOR.test(text) ? ['raw colour value; use a colour role'] : []
  const classNameProblems = text
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((className) => classProblems(className).map((problem) => `"${className}": ${problem}`))
  return [...rawColorProblems, ...classNameProblems]
}

function stringsOf(node, parent) {
  if (parent?.type === 'ImportDeclaration' || parent?.type === 'ExportNamedDeclaration') {
    return []
  }
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return [node.value]
  }
  if (node.type === 'TemplateElement') {
    return [node.value.cooked ?? '']
  }
  return []
}

function isStyleProp(node) {
  return node.type === 'JSXAttribute' && node.name?.name === 'style'
}

function mayUseStyleProp(relativePath) {
  return STYLE_PROP_FOLDERS.some((folder) => relativePath.startsWith(folder))
}

function findViolations(path) {
  const { source, program, relativePath } = parseWebSource(path)
  if (relativePath.startsWith(STYLES_FOLDER)) {
    return []
  }
  const violations = []
  const report = (node, problem) =>
    violations.push(`${relativePath}:${lineOf(source, node.start)} ${problem}`)
  visitNodes(program, (node, parent) => {
    for (const text of stringsOf(node, parent)) {
      for (const problem of stringProblems(text)) {
        report(node, problem)
      }
    }
    if (isStyleProp(node) && !mayUseStyleProp(relativePath)) {
      report(node, 'style prop; style through token classes (web-design-tokens.md → Data colours)')
    }
  })
  return violations
}

const files = webSourceFiles(process.argv.slice(2))
reportAndExit({
  title: 'Visual values must come from tokens (docs/architecture/web-design-tokens.md):',
  violations: files.flatMap(findViolations),
  checkedCount: files.length,
  success: (count) => `Only design tokens in ${count} web source files.`,
})
