import type { AppDeps } from '@api/app.types'
import { createBaseApp } from '@api/core/http/base-app'
import type { AppEnv } from '@api/core/http/http.types'
import { sameOriginWrites } from '@api/core/http/middleware/same-origin-writes'
import { requireSession } from '@api/core/http/middleware/session'
import { accessRoutes, workspaceAccess, workspaceListRoutes } from '@api/modules/access'
import { healthRoutes, PUBLIC_HEALTH_ROUTES } from '@api/modules/health'
import { identityRoutes, PUBLIC_AUTH_ROUTES, resolveSession } from '@api/modules/identity'
import { Hono } from 'hono'

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
    .route('/api/workspaces', workspaceListRoutes(deps))
    .route('/api/workspaces/:workspaceId', workspaceScopedRoutes(deps))
}

function workspaceScopedRoutes(deps: AppDeps) {
  return new Hono<AppEnv>().use(workspaceAccess(deps)).route('/', accessRoutes(deps))
}

export type AppType = ReturnType<typeof createApp>
