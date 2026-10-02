import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { isAbsolute, join, relative } from 'node:path'

const SOURCE_FILE = /^(apps|packages)\/.+\.tsx?$/
const TOKEN_FILE = /^apps\/web\/src\/styles\/tokens\/.+\.css$/
const SOURCE_CHECKS = [
  ['scripts/check-no-comments.mjs'],
  ['scripts/check-file-roles.mjs'],
  ['scripts/check-tokens.mjs'],
  ['scripts/check-copy.mjs'],
]
const TOKEN_CHECKS = [
  ['scripts/check-contrast.mjs'],
  ['scripts/generate-email-colors.mjs', '--check'],
]

export function projectRoot() {
  return process.env.CLAUDE_PROJECT_DIR ?? process.cwd()
}

export function checkedFiles(root, paths) {
  return paths
    .map((path) => relative(root, isAbsolute(path) ? path : join(root, path)))
    .filter(
      (path) => (SOURCE_FILE.test(path) || TOKEN_FILE.test(path)) && existsSync(join(root, path)),
    )
}

export function formatFiles(root, files) {
  const biome = join(root, 'node_modules/.bin/biome')
  runQuietly(biome, ['check', '--write', '--no-errors-on-unmatched', ...files], root)
}

export function conventionProblems(root, files) {
  const sourceFiles = files.filter((path) => SOURCE_FILE.test(path))
  const changesTokens = files.some((path) => TOKEN_FILE.test(path))
  const sourceProblems =
    sourceFiles.length > 0
      ? SOURCE_CHECKS.flatMap(([script]) => run(root, script, sourceFiles))
      : []
  const tokenProblems = changesTokens
    ? TOKEN_CHECKS.flatMap(([script, ...options]) => run(root, script, options))
    : []
  return [...sourceProblems, ...tokenProblems]
}

function run(root, script, args) {
  try {
    execFileSync(process.execPath, [join(root, script), ...args], { cwd: root, stdio: 'pipe' })
    return []
  } catch (error) {
    return [String(error.stderr || error.stdout).trim()]
  }
}

export async function readHookInput() {
  const chunks = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  return text.trim() ? JSON.parse(text) : {}
}

function runQuietly(command, args, cwd) {
  try {
    execFileSync(command, args, { cwd, stdio: 'pipe' })
  } catch {
    return
  }
}
