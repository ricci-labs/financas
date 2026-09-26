import { execFileSync } from 'node:child_process'
import { checkedFiles, conventionProblems, projectRoot, readHookInput } from './conventions.mjs'

const BLOCKING_EXIT_CODE = 2

const input = await readHookInput()
const root = projectRoot()
const files = checkedFiles(root, changedPaths(root))

if (files.length > 0) {
  const problems = conventionProblems(root, files)
  if (problems.length > 0 && !input.stop_hook_active) {
    console.error(
      `Before finishing, fix the convention problems in the files changed on this branch:\n${problems.join('\n')}`,
    )
    process.exit(BLOCKING_EXIT_CODE)
  }
}

function changedPaths(cwd) {
  const git = (args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).split('\n')
  const baseRef = git(['merge-base', 'HEAD', 'origin/main'])[0] ?? 'HEAD'
  const committedOrStaged = git(['diff', '--name-only', '--diff-filter=d', baseRef])
  const untracked = git(['ls-files', '--others', '--exclude-standard'])
  return [...new Set([...committedOrStaged, ...untracked])].filter(Boolean)
}
