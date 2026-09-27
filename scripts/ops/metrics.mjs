import { commandLine, inApp } from './lib.mjs'

const METRICS_URL = `http://127.0.0.1:${process.env.OPS_METRICS_PORT ?? '9464'}/metrics`

const { positionals } = commandLine({})
const [prefix = 'financas_'] = positionals

const lines = inApp(['wget', '-q', '-O', '-', METRICS_URL])
  .split('\n')
  .filter((line) => line.startsWith(prefix))
process.stdout.write(`${lines.join('\n')}\n`)
