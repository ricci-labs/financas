import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { isAbsolute, join, relative } from 'node:path'

const CHECKED_FILE = /^(apps|packages)\/.+\.tsx?$/
const CHECK_SCRIPTS = ['scripts/check-no-comments.mjs', 'scripts/check-file-roles.mjs']

export function projectRoot() {
  return process.env.CLAUDE_PROJECT_DIR ?? process.cwd()
}

export function checkedFiles(root, paths) {
  return paths
    .map((path) => relative(root, isAbsolute(path) ? path : join(root, path)))
    .filter((path) => CHECKED_FILE.test(path) && existsSync(join(root, path)))
}

export function formatFiles(root, files) {
  const biome = join(root, 'node_modules/.bin/biome')
  runQuietly(biome, ['check', '--write', '--no-errors-on-unmatched', ...files], root)
}

export function conventionProblems(root, files) {
  return CHECK_SCRIPTS.flatMap((script) => {
    try {
      execFileSync(process.execPath, [join(root, script), ...files], { cwd: root, stdio: 'pipe' })
      return []
    } catch (error) {
      return [String(error.stderr || error.stdout).trim()]
    }
  })
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
