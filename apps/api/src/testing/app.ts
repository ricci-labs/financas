import type { AppDeps } from '@api/app'
import { createDatabase } from '@api/core/db/client'
import { sessionCookieSettings } from '@api/core/http/session-cookie'
import { createLoginLimits } from '@api/modules/identity'
import { createCapturingLogger } from '@api/testing/logger'
import { createRecordingMailer } from '@api/testing/mailer'

export const TEST_PUBLIC_URL = 'http://localhost:5173'
const NEVER_CONNECTED_DATABASE_URL = 'postgres://unused:unused@127.0.0.1:1/unused'

export function testAppDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  const unusedDatabase = createDatabase(NEVER_CONNECTED_DATABASE_URL, {
    onConnectionError: (error) => {
      throw error
    },
  })
  return {
    version: 'test-sha',
    startedAt: Date.now(),
    isDatabaseReachable: async () => true,
    logger: createCapturingLogger().logger,
    db: unusedDatabase.db,
    mailer: createRecordingMailer().mailer,
    publicUrl: TEST_PUBLIC_URL,
    isPublicSignupEnabled: false,
    cookie: sessionCookieSettings('test'),
    loginLimits: createLoginLimits({
      maxFailuresPerEmail: 5,
      maxFailuresPerClient: 30,
      windowMinutes: 15,
    }),
    trustedProxyHops: 0,
    ...overrides,
  }
}
