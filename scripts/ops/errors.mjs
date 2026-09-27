import { commandLine, levelNumber, logEntries } from './lib.mjs'

const { values } = commandLine({
  since: { type: 'string', default: '24h' },
  module: { type: 'string' },
})
const errorLevel = levelNumber('error')

const groups = new Map()
for (const entry of logEntries(values.since)) {
  if (entry.level < errorLevel || (values.module && entry.module !== values.module)) {
    continue
  }
  const key = entry.fingerprint ?? `${entry.event ?? 'no-event'}:${entry.err?.message ?? entry.msg}`
  const group = groups.get(key) ?? { fingerprint: key, count: 0 }
  groups.set(key, {
    ...group,
    count: group.count + 1,
    lastSeen: new Date(entry.time).toISOString(),
    event: entry.event,
    module: entry.module,
    lastTraceId: entry.trace_id,
    message: entry.err?.message ?? entry.msg,
  })
}

const sorted = [...groups.values()].sort((left, right) => right.count - left.count)
process.stdout.write(`# ${sorted.length} error groups since ${values.since}\n`)
for (const group of sorted) {
  process.stdout.write(`${JSON.stringify(group)}\n`)
}
