import type { AppEnv } from '@api/core/http/http.types'
import { currentSession } from '@api/core/http/middleware/session'
import { authorizeAnyMember, currentWorkspace } from '@api/modules/access/access.middleware'
import { listWorkspacesOfUser, loadWorkspaceAccess } from '@api/modules/access/access.service'
import type { AccessRouteDeps } from '@api/modules/access/access.types'
import { Hono } from 'hono'

export function accessRoutes({ db }: AccessRouteDeps) {
  return new Hono<AppEnv>().get('/', authorizeAnyMember(), async (c) => {
    const { workspaceId } = currentWorkspace(c)
    const access = await loadWorkspaceAccess(db, { workspaceId, userId: currentSession(c).userId })
    return c.json(access)
  })
}

export function workspaceListRoutes({ db }: AccessRouteDeps) {
  return new Hono<AppEnv>().get('/', async (c) => {
    const { userId } = currentSession(c)
    return c.json(await listWorkspacesOfUser(db, userId))
  })
}
