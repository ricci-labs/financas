import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'

const LEVELS = { trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60 }
const DURATION = /^(\d+)([smhd])$/
const SECONDS_PER_UNIT = { s: 1, m: 60, h: 3600, d: 86400 }
const MAX_OUTPUT_BYTES = 512 * 1024 * 1024

export const APP_CONTAINER = process.env.OPS_APP_CONTAINER ?? 'financas-api'
export const DB_CONTAINER = process.env.OPS_DB_CONTAINER ?? 'financas-db'
const LOGS_FILE = process.env.OPS_LOGS_FILE

export function fail(message) {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}

export function commandLine(options) {
  try {
    return parseArgs({ options, allowPositionals: true })
  } catch (error) {
    return fail(error.message)
  }
}

export function levelNumber(name) {
  const level = LEVELS[name]
  if (level === undefined) {
    fail(`Unknown level "${name}". Use one of: ${Object.keys(LEVELS).join(', ')}`)
  }
  return level
}

export function secondsOf(duration) {
  const match = duration.match(DURATION)
  if (!match) {
    fail(`Invalid duration "${duration}". Use a number and s, m, h or d, like 30m or 2d`)
  }
  return Number(match[1]) * SECONDS_PER_UNIT[match[2]]
}

export function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: MAX_OUTPUT_BYTES })
  if (result.error) {
    fail(`${command} failed: ${result.error.message}`)
  }
  return result
}

export function containerNamed(prefix, variable) {
  const listed = run('docker', ['ps', '--filter', `name=${prefix}`, '--format', '{{.Names}}'])
  const name = listed.stdout.split('\n').find(Boolean)
  if (!name) {
    fail(`No running container matches "${prefix}". Set ${variable} to its name or prefix.`)
  }
  return name
}

export function inApp(args) {
  const result = run('docker', [
    'exec',
    containerNamed(APP_CONTAINER, 'OPS_APP_CONTAINER'),
    ...args,
  ])
  if (result.status !== 0) {
    fail(result.stderr.trim() || `Command failed in the app container: ${args.join(' ')}`)
  }
  return result.stdout
}

export function sqlInDatabase(sql) {
  const container = containerNamed(DB_CONTAINER, 'OPS_DB_CONTAINER')
  const result = run('docker', [
    'exec',
    container,
    'psql',
    '-U',
    'postgres',
    '-d',
    'financas',
    '-X',
    '-A',
    '-F',
    '\t',
    '-c',
    sql,
  ])
  if (result.status !== 0) {
    fail(result.stderr.trim())
  }
  return result.stdout
}

export function logEntries(since) {
  const seconds = secondsOf(since)
  const text = LOGS_FILE ? readFileSync(LOGS_FILE, 'utf8') : dockerLogs(seconds)
  const cutoff = Date.now() - seconds * 1000
  return text
    .split('\n')
    .map(parsedEntry)
    .filter((entry) => entry && (entry.time === undefined || entry.time >= cutoff))
}

export function printEntries(entries) {
  for (const entry of entries) {
    process.stdout.write(`${JSON.stringify(entry)}\n`)
  }
}

function dockerLogs(seconds) {
  const container = containerNamed(APP_CONTAINER, 'OPS_APP_CONTAINER')
  const result = run('docker', ['logs', '--since', `${seconds}s`, container])
  return `${result.stdout}\n${result.stderr}`
}

function parsedEntry(line) {
  if (!line.startsWith('{')) {
    return undefined
  }
  try {
    return JSON.parse(line)
  } catch {
    return undefined
  }
}
