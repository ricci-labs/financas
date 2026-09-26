import type { BackgroundTasks } from '@api/core/background-tasks.types'
import type { Database } from '@api/core/db/client'
import type { Mailer } from '@api/core/email/email.types'
import type { SessionCookieSettings } from '@api/core/http/http.types'
import type { Logger } from '@api/core/observability/logger'
import type { AccountEmailLimits, LoginLimits } from '@api/modules/identity'

export type AppDeps = {
  version: string
  startedAt: number
  isDatabaseReachable: () => Promise<boolean>
  logger: Logger
  db: Database
  mailer: Mailer
  publicUrl: string
  isPublicSignupEnabled: boolean
  cookie: SessionCookieSettings
  loginLimits: LoginLimits
  accountEmailLimits: AccountEmailLimits
  trustedProxyHops: number
  background: BackgroundTasks
}
