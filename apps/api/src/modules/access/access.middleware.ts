import { ForbiddenError, NotFoundError } from '@api/core/http/errors'
import type { AppEnv, RequestWorkspace } from '@api/core/http/http.types'
import { currentSession } from '@api/core/http/middleware/session'
import { loadWorkspaceAccess } from '@api/modules/access/access.service'
import type { AccessRouteDeps } from '@api/modules/access/access.types'
import { type AppModule, can, type PermissionAction } from '@financas/shared'
import type { Context, MiddlewareHandler } from 'hono'
import { createMiddleware } from 'hono/factory'
import { z } from 'zod'

const workspaceIdSchema = z.uuid()
const permissionChecks = new WeakSet<MiddlewareHandler>()

export function workspaceAccess({ db }: AccessRouteDeps) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const workspaceId = workspaceIdSchema.safeParse(c.req.param('workspaceId'))
    if (!workspaceId.success) {
      throw workspaceNotFound()
    }

    const { userId } = currentSession(c)
    const access = await loadWorkspaceAccess(db, { workspaceId: workspaceId.data, userId })
    if (!access) {
      throw workspaceNotFound()
    }

    c.set('workspace', {
      workspaceId: workspaceId.data,
      membershipId: access.membershipId,
      permissions: access.permissions,
    })
    await next()
  })
}

export function authorize(module: AppModule, action: PermissionAction) {
  const check = createMiddleware<AppEnv>(async (c, next) => {
    const workspace = currentWorkspace(c)
    if (!can(workspace.permissions, module, action)) {
      c.get('logger').warn(
        {
          event: 'authz.denied',
          module,
          action,
          workspaceId: workspace.workspaceId,
          userId: currentSession(c).userId,
        },
        'Permission denied',
      )
      throw new ForbiddenError('PERMISSION_DENIED', `Missing permission ${module}:${action}`)
    }
    await next()
  })
  permissionChecks.add(check)
  return check
}

export function authorizeAnyMember() {
  const check = createMiddleware<AppEnv>(async (c, next) => {
    currentWorkspace(c)
    await next()
  })
  permissionChecks.add(check)
  return check
}

export function isPermissionCheck(handler: unknown): boolean {
  return typeof handler === 'function' && permissionChecks.has(handler as MiddlewareHandler)
}

export function currentWorkspace(c: Context<AppEnv>): RequestWorkspace {
  const workspace = c.get('workspace')
  if (!workspace) {
    throw workspaceNotFound()
  }
  return workspace
}

function workspaceNotFound(): NotFoundError {
  return new NotFoundError('WORKSPACE_NOT_FOUND', 'Workspace not found')
}
