import { readdirSync, readFileSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { parseSync } from 'oxc-parser'

const WEB_SOURCE_ROOT = 'apps/web/src'
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx'])
const GENERATED_FILE = /\.gen\.ts$/

export function isWebSourceFile(path) {
  const relativePath = relative(process.cwd(), path)
  return (
    relativePath.startsWith(`${WEB_SOURCE_ROOT}/`) &&
    SOURCE_EXTENSIONS.has(extname(path)) &&
    !GENERATED_FILE.test(path)
  )
}

export function webSourceFiles(requestedFiles) {
  if (requestedFiles.length > 0) {
    return requestedFiles.filter(isWebSourceFile)
  }
  return readdirSync(WEB_SOURCE_ROOT, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .filter(isWebSourceFile)
}

export function parseWebSource(path) {
  const source = readFileSync(path, 'utf8')
  const { program } = parseSync(path, source)
  return { source, program, relativePath: relative(process.cwd(), path) }
}

export function lineOf(source, offset) {
  return source.slice(0, offset).split('\n').length
}

function isAstNode(value) {
  return value !== null && typeof value === 'object' && typeof value.type === 'string'
}

export function visitNodes(node, visit, parent = null) {
  visit(node, parent)
  for (const value of Object.values(node)) {
    const children = Array.isArray(value) ? value : [value]
    for (const child of children.filter(isAstNode)) {
      visitNodes(child, visit, node)
    }
  }
}

export function reportAndExit({ title, violations, checkedCount, success }) {
  if (violations.length > 0) {
    console.error(title)
    for (const violation of violations) {
      console.error(`  ${violation}`)
    }
    process.exit(1)
  }
  console.log(success(checkedCount))
}
