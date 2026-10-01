import {
  lineOf,
  parseWebSource,
  reportAndExit,
  visitNodes,
  webSourceFiles,
} from './web/web-sources.mjs'

const COMPONENT_FILE = /\.tsx$/
const COPY_ALLOWED_FILE = /\.(?:examples|test)\.tsx$/
const COPY_PROPS = new Set([
  'label',
  'placeholder',
  'title',
  'alt',
  'aria-label',
  'aria-description',
  'aria-placeholder',
])
const HAS_LETTER = /\p{L}/u
const MESSAGES_HINT = 'belongs in a .messages.ts file (web-components.md → Copy)'

function isCopy(value) {
  return typeof value === 'string' && HAS_LETTER.test(value)
}

function literalOf(attributeValue) {
  if (attributeValue?.type === 'Literal') {
    return attributeValue.value
  }
  if (attributeValue?.type === 'JSXExpressionContainer') {
    const expression = attributeValue.expression
    if (expression.type === 'Literal') {
      return expression.value
    }
    if (expression.type === 'TemplateLiteral' && expression.expressions.length === 0) {
      return expression.quasis[0].value.cooked
    }
  }
  return null
}

function copyProblem(node) {
  if (node.type === 'JSXText' && isCopy(node.value)) {
    return `text "${node.value.trim()}" ${MESSAGES_HINT}`
  }
  if (node.type === 'JSXAttribute' && COPY_PROPS.has(node.name?.name)) {
    const value = literalOf(node.value)
    return isCopy(value) ? `${node.name.name}="${value}" ${MESSAGES_HINT}` : null
  }
  return null
}

function findViolations(path) {
  const { source, program, relativePath } = parseWebSource(path)
  if (!COMPONENT_FILE.test(relativePath) || COPY_ALLOWED_FILE.test(relativePath)) {
    return []
  }
  const violations = []
  visitNodes(program, (node) => {
    const problem = copyProblem(node)
    if (problem) {
      violations.push(`${relativePath}:${lineOf(source, node.start)} ${problem}`)
    }
  })
  return violations
}

const files = webSourceFiles(process.argv.slice(2))
reportAndExit({
  title: 'User-facing copy must come from messages files:',
  violations: files.flatMap(findViolations),
  checkedCount: files.length,
  success: (count) => `No hard-coded copy in ${count} web source files.`,
})
