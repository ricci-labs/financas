import { parseArgs } from 'node:util'
import { systemClock } from '@api/core/clock'
import { loadEnv, publicUrlOf } from '@api/core/config/env'
import { createDatabase } from '@api/core/db/client'
import { createMailer } from '@api/core/email/mailer'
import { createLogger } from '@api/core/observability/logger'
import { createLocalFileStorage } from '@api/core/storage/local-file-storage'
import { SCHEDULED_JOBS } from '@api/jobs/scheduled-jobs'
import { runJob } from '@api/jobs/scheduler'

const FAILURE_EXIT_CODE = 1

const { values, positionals } = parseArgs({
  options: { at: { type: 'string' } },
  allowPositionals: true,
})
const job = SCHEDULED_JOBS.find((candidate) => candidate.name === positionals[0])
const at = values.at ? new Date(values.at) : undefined

if (!job || (at && Number.isNaN(at.getTime()))) {
  const names = SCHEDULED_JOBS.map((candidate) => candidate.name).join(', ')
  process.stderr.write(`Usage: run-job <${names}> [--at 2026-10-01T12:00:00Z]\n`)
  process.exit(FAILURE_EXIT_CODE)
}

const env = loadEnv()
const logger = createLogger(env)
const database = createDatabase(env.DATABASE_URL, {
  onConnectionError: (err) => {
    logger.warn({ event: 'db.connection.lost', err }, 'Idle database connection lost')
  },
})

try {
  const succeeded = await runJob(job, {
    db: database.db,
    clock: at ? { now: () => at } : systemClock,
    logger: logger.child({ module: 'jobs', channel: 'ops' }),
    mailer: createMailer(env, logger.child({ module: 'email' })),
    publicUrl: publicUrlOf(env),
    fileStorage: createLocalFileStorage(env.FILE_STORAGE_DIR),
  })
  process.exitCode = succeeded ? 0 : FAILURE_EXIT_CODE
} finally {
  await database.close()
}
