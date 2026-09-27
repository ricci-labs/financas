import { commandLine, levelNumber, logEntries, printEntries } from './lib.mjs'

const { values } = commandLine({
  since: { type: 'string', default: '1h' },
  level: { type: 'string', default: 'debug' },
  event: { type: 'string' },
  module: { type: 'string' },
})
const minimumLevel = levelNumber(values.level)

printEntries(
  logEntries(values.since).filter(
    (entry) =>
      entry.level >= minimumLevel &&
      (!values.event || String(entry.event ?? '').startsWith(values.event)) &&
      (!values.module || entry.module === values.module),
  ),
)
