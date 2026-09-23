import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'

const REQUIRED_FRONTMATTER = ['summary:', 'read_when:', 'updated:']
const IGNORED_LINK_TARGETS = new Set(['SKILL.md', 'CLAUDE.md', 'README.md'])
const LINK_PATTERNS = [
  /`((?:\.\.\/|docs\/)[\w./-]+\.md)`/g,
  /\]\(([\w./-]+\.md)\)/g,
  /`([\w-]+\.md)`/g,
]

function listDocs() {
  return readdirSync('docs', { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => join(entry.parentPath, entry.name))
}

function missingFrontmatter(path, content) {
  const header = content.slice(0, 600)
  return REQUIRED_FRONTMATTER.filter((key) => !header.includes(key)).map(
    (key) => `${path}: missing frontmatter "${key.slice(0, -1)}"`,
  )
}

function linkedPaths(content) {
  return LINK_PATTERNS.flatMap((pattern) => [...content.matchAll(pattern)].map((match) => match[1]))
}

function resolveLink(fromPath, target) {
  return target.startsWith('docs/') ? normalize(target) : normalize(join(dirname(fromPath), target))
}

function brokenLinks(path, content) {
  return linkedPaths(content)
    .filter((target) => !IGNORED_LINK_TARGETS.has(target))
    .filter((target) => !existsSync(resolveLink(path, target)))
    .map((target) => `${path}: broken link "${target}"`)
}

const files = [...listDocs(), 'CLAUDE.md', 'README.md']
const problems = files.flatMap((path) => {
  const content = readFileSync(path, 'utf8')
  const frontmatterProblems = path.startsWith('docs') ? missingFrontmatter(path, content) : []
  return [...frontmatterProblems, ...brokenLinks(path, content)]
})

if (problems.length > 0) {
  for (const problem of problems) {
    console.error(problem)
  }
  process.exit(1)
}

console.log(`Docs OK: ${files.length} files checked.`)
