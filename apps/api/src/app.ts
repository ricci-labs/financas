import type { BackgroundTasks } from '@api/core/background-tasks'
import type { Database } from '@api/core/db/client'
import type { Mailer } from '@api/core/email/email.types'
import { createBaseApp } from '@api/core/http/base-app'
import { sameOriginWrites } from '@api/core/http/middleware/same-origin-writes'
import { requireSession } from '@api/core/http/middleware/session'
import type { SessionCookieSettings } from '@api/core/http/session-cookie'
import type { Logger } from '@api/core/observability/logger'
import { healthRoutes, PUBLIC_HEALTH_ROUTES } from '@api/modules/health'
import {
  type AccountEmailLimits,
  identityRoutes,
  type LoginLimits,
  PUBLIC_AUTH_ROUTES,
  resolveSession,
} from '@api/modules/identity'

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

export const PUBLIC_ROUTES: ReadonlySet<string> = new Set([
  ...PUBLIC_HEALTH_ROUTES,
  ...PUBLIC_AUTH_ROUTES,
])

export function createApp(deps: AppDeps) {
  return createBaseApp(deps.logger)
    .use('/api/*', sameOriginWrites(new URL(deps.publicUrl).origin))
    .use(
      '/api/*',
      requireSession({
        resolve: (token) => resolveSession(deps.db, token),
        publicRoutes: PUBLIC_ROUTES,
        cookie: deps.cookie,
      }),
    )
    .route('/api/health', healthRoutes(deps))
    .route('/api/auth', identityRoutes(deps))
}

export type AppType = ReturnType<typeof createApp>
