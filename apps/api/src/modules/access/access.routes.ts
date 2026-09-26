import type { AppEnv } from '@api/core/http/http.types'
import { currentSession } from '@api/core/http/middleware/session'
import { jsonBody, pathParams } from '@api/core/http/validation'
import {
  authorize,
  authorizeAnyMember,
  currentWorkspace,
} from '@api/modules/access/access.middleware'
import {
  changeMemberRole,
  changeRole,
  createRole,
  deleteRole,
  listMembers,
  listRoles,
  listWorkspacesOfUser,
  loadWorkspaceAccess,
  removeMember,
} from '@api/modules/access/access.service'
import type { AccessRouteDeps, MemberActor } from '@api/modules/access/access.types'
import {
  deletionRequestSchema,
  memberParamsSchema,
  memberRemovalSchema,
  memberRoleChangeSchema,
  newRoleSchema,
  roleChangeSchema,
  roleParamsSchema,
} from '@financas/shared'
import { type Context, Hono } from 'hono'

const CREATED = 201
const NO_CONTENT = 204
const ROLE_INVALID = 'ROLE_INVALID'

export function accessRoutes({ db }: AccessRouteDeps) {
  const member = pathParams(memberParamsSchema, 'MEMBER_NOT_FOUND')

  return new Hono<AppEnv>()
    .get('/', authorizeAnyMember(), async (c) => {
      const { workspaceId } = currentWorkspace(c)
      const access = await loadWorkspaceAccess(db, {
        workspaceId,
        userId: currentSession(c).userId,
      })
      return c.json(access)
    })
    .get('/members', authorize('members', 'view'), async (c) => {
      return c.json(await listMembers(db, currentWorkspace(c).workspaceId))
    })
    .patch(
      '/members/:membershipId',
      authorize('members', 'update'),
      member,
      jsonBody(memberRoleChangeSchema, 'MEMBER_ROLE_INVALID'),
      async (c) => {
        await changeMemberRole(db, {
          actor: actorOf(c),
          membershipId: c.req.valid('param').membershipId,
          roleId: c.req.valid('json').roleId,
        })
        return c.body(null, NO_CONTENT)
      },
    )
    .delete(
      '/members/:membershipId',
      authorize('members', 'delete'),
      member,
      jsonBody(memberRemovalSchema, 'DELETION_INVALID'),
      async (c) => {
        await removeMember(db, {
          actor: actorOf(c),
          membershipId: c.req.valid('param').membershipId,
          reason: c.req.valid('json').reason,
        })
        return c.body(null, NO_CONTENT)
      },
    )
    .post('/members/leave', authorizeAnyMember(), async (c) => {
      await removeMember(db, { actor: actorOf(c), membershipId: currentWorkspace(c).membershipId })
      return c.body(null, NO_CONTENT)
    })
    .route('/roles', roleRoutes({ db }))
}

function roleRoutes({ db }: AccessRouteDeps) {
  const role = pathParams(roleParamsSchema, 'ROLE_NOT_FOUND')

  return new Hono<AppEnv>()
    .get('/', authorize('members', 'view'), async (c) => {
      return c.json(await listRoles(db, currentWorkspace(c).workspaceId))
    })
    .post('/', authorize('members', 'create'), jsonBody(newRoleSchema, ROLE_INVALID), async (c) => {
      return c.json(await createRole(db, { actor: actorOf(c), role: c.req.valid('json') }), CREATED)
    })
    .patch(
      '/:roleId',
      authorize('members', 'update'),
      role,
      jsonBody(roleChangeSchema, ROLE_INVALID),
      async (c) => {
        await changeRole(db, {
          actor: actorOf(c),
          roleId: c.req.valid('param').roleId,
          change: c.req.valid('json'),
        })
        return c.body(null, NO_CONTENT)
      },
    )
    .delete(
      '/:roleId',
      authorize('members', 'delete'),
      role,
      jsonBody(deletionRequestSchema, 'DELETION_INVALID'),
      async (c) => {
        await deleteRole(db, {
          actor: actorOf(c),
          roleId: c.req.valid('param').roleId,
          reason: c.req.valid('json').reason,
        })
        return c.body(null, NO_CONTENT)
      },
    )
}

export function workspaceListRoutes({ db }: AccessRouteDeps) {
  return new Hono<AppEnv>().get('/', async (c) => {
    const { userId } = currentSession(c)
    return c.json(await listWorkspacesOfUser(db, userId))
  })
}

function actorOf(c: Context<AppEnv>): MemberActor {
  const { workspaceId, roleKey, permissions } = currentWorkspace(c)
  return { workspaceId, roleKey, permissions, userId: currentSession(c).userId }
}
