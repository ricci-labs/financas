import type { AppEnv } from '@api/core/http/http.types'
import { currentSession } from '@api/core/http/middleware/session'
import { jsonBody } from '@api/core/http/validation'
import { authorize, currentWorkspace } from '@api/modules/access'
import { createWorkspace } from '@api/modules/onboarding'
import {
  changeWorkspaceSettings,
  getWorkspaceSettings,
  renameWorkspace,
} from '@api/modules/workspaces/workspaces.service'
import type { WorkspaceRouteDeps } from '@api/modules/workspaces/workspaces.types'
import { workspaceNameRequestSchema, workspaceSettingsChangeSchema } from '@financas/shared'
import { Hono } from 'hono'

const CREATED = 201
const NO_CONTENT = 204
const NAME_INVALID = 'WORKSPACE_NAME_INVALID'

export function workspaceCreationRoutes({ db }: WorkspaceRouteDeps) {
  return new Hono<AppEnv>().post(
    '/',
    jsonBody(workspaceNameRequestSchema, NAME_INVALID),
    async (c) => {
      const { userId } = currentSession(c)
      const created = await createWorkspace(db, {
        name: c.req.valid('json').name,
        ownerUserId: userId,
      })
      return c.json({ workspaceId: created.workspaceId }, CREATED)
    },
  )
}

export function workspaceSettingsRoutes({ db }: WorkspaceRouteDeps) {
  return new Hono<AppEnv>()
    .patch(
      '/',
      authorize('settings', 'update'),
      jsonBody(workspaceNameRequestSchema, NAME_INVALID),
      async (c) => {
        const { workspaceId } = currentWorkspace(c)
        await renameWorkspace(db, { workspaceId, name: c.req.valid('json').name })
        return c.body(null, NO_CONTENT)
      },
    )
    .get('/settings', authorize('settings', 'view'), async (c) => {
      return c.json(await getWorkspaceSettings(db, currentWorkspace(c).workspaceId))
    })
    .patch(
      '/settings',
      authorize('settings', 'update'),
      jsonBody(workspaceSettingsChangeSchema, 'SETTINGS_INVALID'),
      async (c) => {
        const { workspaceId } = currentWorkspace(c)
        return c.json(await changeWorkspaceSettings(db, workspaceId, c.req.valid('json')))
      },
    )
}
