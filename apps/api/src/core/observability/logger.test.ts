import { createLogger } from '@api/core/observability/logger'
import { describe, expect, it } from 'vitest'

const TEST_ENV = { LOG_LEVEL: 'info', NODE_ENV: 'test', APP_VERSION: 'test-sha' } as const

function captureLogs() {
  const lines: string[] = []
  const logger = createLogger(TEST_ENV, { write: (line: string) => lines.push(line) })
  return { logger, output: () => lines.join('') }
}

describe('createLogger', () => {
  it('never writes passwords, hashes or tokens, at the top level or one level down', () => {
    const { logger, output } = captureLogs()
    logger.info(
      {
        event: 'test.secrets.logged',
        password: 'plain-password-1',
        passwordHash: 'scrypt$hash-2',
        token: 'raw-token-3',
        input: { newPassword: 'plain-password-4', currentPassword: 'plain-password-5' },
        session: { tokenHash: 'hash-6' },
      },
      'Secrets must not appear',
    )
    const written = output()
    for (const secret of ['plain-password', 'scrypt$hash', 'raw-token', 'hash-6']) {
      expect(written).not.toContain(secret)
    }
    expect(written).toContain('[redacted]')
    expect(written).toContain('test.secrets.logged')
  })

  it('never writes cookies or the authorization header', () => {
    const { logger, output } = captureLogs()
    logger.info({
      req: { headers: { cookie: 'session=abc', authorization: 'Bearer xyz' } },
      res: { headers: { 'set-cookie': 'session=def' } },
    })
    const written = output()
    for (const secret of ['session=abc', 'Bearer xyz', 'session=def']) {
      expect(written).not.toContain(secret)
    }
  })
})
