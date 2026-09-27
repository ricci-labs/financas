import { commandLine, fail, logEntries, printEntries, sqlInDatabase } from './lib.mjs'

const TRACE_REF = /^[0-9a-f]{8,32}$/

const { values, positionals } = commandLine({
  since: { type: 'string', default: '7d' },
  'no-audit': { type: 'boolean', default: false },
})
const [ref] = positionals
if (!ref || !TRACE_REF.test(ref)) {
  fail('Usage: ops:trace <trace id or its first 8 characters> [--since 7d] [--no-audit]')
}

const entries = logEntries(values.since).filter((entry) =>
  String(entry.trace_id ?? '').startsWith(ref),
)
process.stdout.write(`# ${entries.length} log lines\n`)
printEntries(entries)

if (!values['no-audit']) {
  process.stdout.write('# audit_log rows\n')
  process.stdout.write(
    sqlInDatabase(
      `select at, workspace_id, source, action, table_name, row_id, actor_user_id from audit_log where trace_id like '${ref}%' order by at, id`,
    ),
  )
}
