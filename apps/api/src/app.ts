import type { AppDeps } from '@api/app.types'
import { createBaseApp } from '@api/core/http/base-app'
import type { AppEnv } from '@api/core/http/http.types'
import { sameOriginWrites } from '@api/core/http/middleware/same-origin-writes'
import { requireSession } from '@api/core/http/middleware/session'
import { workspaceAccess } from '@api/modules/access'
import { accessRoutes, workspaceListRoutes } from '@api/modules/access/access.routes'
import { healthRoutes, PUBLIC_HEALTH_ROUTES } from '@api/modules/health/health.routes'
import { resolveSession } from '@api/modules/identity'
import { identityRoutes, PUBLIC_AUTH_ROUTES } from '@api/modules/identity/identity.routes'
import { ledgerRoutes } from '@api/modules/ledger/ledger.routes'
import {
  invitationResponseRoutes,
  invitationRoutes,
  PUBLIC_INVITATION_ROUTES,
} from '@api/modules/onboarding/onboarding.routes'
import { planningRoutes } from '@api/modules/planning/planning.routes'
import {
  workspaceCreationRoutes,
  workspaceSettingsRoutes,
} from '@api/modules/workspaces/workspaces.routes'
import { Hono } from 'hono'

export const PUBLIC_ROUTES: ReadonlySet<string> = new Set([
  ...PUBLIC_HEALTH_ROUTES,
  ...PUBLIC_AUTH_ROUTES,
  ...PUBLIC_INVITATION_ROUTES,
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
    .route('/api/invitations', invitationResponseRoutes(deps))
    .route('/api/workspaces', workspaceListRoutes(deps))
    .route('/api/workspaces', workspaceCreationRoutes(deps))
    .route('/api/workspaces/:workspaceId', workspaceScopedRoutes(deps))
}

function workspaceScopedRoutes(deps: AppDeps) {
  return new Hono<AppEnv>()
    .use(workspaceAccess(deps))
    .route('/', accessRoutes(deps))
    .route('/', workspaceSettingsRoutes(deps))
    .route('/', ledgerRoutes(deps))
    .route('/', planningRoutes(deps))
    .route('/invitations', invitationRoutes(deps))
}

export type AppType = ReturnType<typeof createApp>
