import { APP_CONTAINER, containerNamed, DB_CONTAINER, inApp, run } from './lib.mjs'

const READY_URL = `http://127.0.0.1:${process.env.OPS_APP_PORT ?? '3100'}/api/health/ready`

for (const [prefix, variable] of [
  [APP_CONTAINER, 'OPS_APP_CONTAINER'],
  [DB_CONTAINER, 'OPS_DB_CONTAINER'],
]) {
  const name = containerNamed(prefix, variable)
  const state = run('docker', [
    'inspect',
    '--format',
    '{{.State.Status}} since {{.State.StartedAt}}, health {{if .State.Health}}{{.State.Health.Status}}{{else}}n/a{{end}}, restarts {{.RestartCount}}, image {{.Config.Image}}',
    name,
  ])
  process.stdout.write(`${name}: ${state.stdout.trim()}\n`)
}
process.stdout.write(`ready: ${inApp(['wget', '-q', '-O', '-', READY_URL]).trim()}\n`)
