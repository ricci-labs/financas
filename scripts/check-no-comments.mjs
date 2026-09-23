import { readdirSync, readFileSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { parseSync } from 'oxc-parser'

const SOURCE_ROOTS = ['apps', 'packages', 'scripts']
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs'])
const IGNORED_DIRECTORIES = new Set(['node_modules', 'dist', 'drizzle'])
const TOOL_DIRECTIVES = ['biome-ignore', '@ts-expect-error']

function isSourceFile(path) {
  return SOURCE_EXTENSIONS.has(extname(path)) && !path.endsWith('.gen.ts')
}

function listSourceFiles(root) {
  const entries = readdirSync(root, { recursive: true, withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((path) => !path.split('/').some((part) => IGNORED_DIRECTORIES.has(part)))
    .filter(isSourceFile)
}

function isToolDirective(comment) {
  const text = comment.value.trim()
  return TOOL_DIRECTIVES.some((directive) => text.startsWith(directive))
}

function lineOf(source, offset) {
  return source.slice(0, offset).split('\n').length
}

function findComments(path) {
  const source = readFileSync(path, 'utf8')
  const { comments } = parseSync(path, source)
  return comments
    .filter((comment) => !isToolDirective(comment))
    .map((comment) => `${relative(process.cwd(), path)}:${lineOf(source, comment.start)}`)
}

const requestedFiles = process.argv.slice(2).filter(isSourceFile)
const files = requestedFiles.length > 0 ? requestedFiles : SOURCE_ROOTS.flatMap(listSourceFiles)
const violations = files.flatMap(findComments)

if (violations.length > 0) {
  console.error('Comments are not allowed in source code (docs/architecture/conventions.md):')
  for (const violation of violations) {
    console.error(`  ${violation}`)
  }
  process.exit(1)
}

console.log(`No comments found in ${files.length} source files.`)
