import {
  checkedFiles,
  conventionProblems,
  formatFiles,
  projectRoot,
  readHookInput,
} from './conventions.mjs'

const BLOCKING_EXIT_CODE = 2

const input = await readHookInput()
const root = projectRoot()
const editedPath = input.tool_input?.file_path ?? input.tool_response?.filePath
const files = editedPath ? checkedFiles(root, [editedPath]) : []

if (files.length > 0) {
  formatFiles(root, files)
  const problems = conventionProblems(root, files)
  if (problems.length > 0) {
    console.error(
      `Project conventions broken in ${files.join(', ')}. Fix it now:\n${problems.join('\n')}`,
    )
    process.exit(BLOCKING_EXIT_CODE)
  }
}
