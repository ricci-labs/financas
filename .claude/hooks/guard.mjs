import { execFileSync } from 'node:child_process'
import { relative } from 'node:path'
import { projectRoot, readHookInput } from './conventions.mjs'

const ENV_FILE = /(^|\/)\.env(\.(?!example$)[^/]+)?$/
const MIGRATION_FILE = /^apps\/api\/drizzle\//
const SKIPPED_HOOKS = /--no-verify\b|\bgit\s+commit\b[^|;&\n]*\s-n\b/
const FORCE_PUSH = /\bgit\s+push\b[^|;&\n]*(--force\b|--force-with-lease\b|\s-f\b|\s\+)/
const MAIN_BRANCH = 'main'
const NAMES_MAIN = /\bgit\s+push\b[^|;&\n]*\bmain\b/

const input = await readHookInput()
const root = projectRoot()
const reason = input.tool_name === 'Bash' ? bashRisk(input.tool_input?.command ?? '') : fileRisk()

if (reason) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    }),
  )
}

function fileRisk() {
  const path = input.tool_input?.file_path
  if (!path) {
    return undefined
  }
  const relativePath = relative(root, path)
  if (ENV_FILE.test(relativePath)) {
    return 'Env files hold secrets and are edited by the user only (CLAUDE.md). Change .env.example instead.'
  }
  if (MIGRATION_FILE.test(relativePath) && isTracked(relativePath)) {
    return 'This migration is already committed. Never edit an applied migration: generate a new one (docs/architecture/conventions.md → Migrations).'
  }
  return undefined
}

function bashRisk(command) {
  if (SKIPPED_HOOKS.test(command)) {
    return 'Git hooks must not be bypassed (docs/engineering/git-workflow.md). Fix what the hook reports.'
  }
  const isForcePushToMain =
    FORCE_PUSH.test(command) && (NAMES_MAIN.test(command) || currentBranch() === MAIN_BRANCH)
  if (isForcePushToMain) {
    return 'Force pushing to main is not allowed; main only changes through squash-merged PRs.'
  }
  return undefined
}

function isTracked(path) {
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', path], { cwd: root, stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

function currentBranch() {
  return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim()
}
