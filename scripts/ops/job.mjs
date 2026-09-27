import { commandLine, fail, inApp } from './lib.mjs'

const { values, positionals } = commandLine({ at: { type: 'string' } })
const [job] = positionals
if (!job) {
  fail('Usage: ops:job <job name> [--at 2026-10-01T12:00:00Z]')
}

process.stdout.write(
  inApp(['node', 'dist/ops/run-job.mjs', job, ...(values.at ? ['--at', values.at] : [])]),
)
