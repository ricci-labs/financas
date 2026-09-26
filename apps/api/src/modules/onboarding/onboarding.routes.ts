import type { AppEnv } from '@api/core/http/http.types'
import { currentSession } from '@api/core/http/middleware/session'
import { jsonBody, pathParams } from '@api/core/http/validation'
import { authorize, currentWorkspace } from '@api/modules/access'
import { listPendingInvitations, revokeInvitation } from '@api/modules/members'
import { inviteMember, sendInvitationEmail } from '@api/modules/onboarding/onboarding.service'
import type { OnboardingRouteDeps } from '@api/modules/onboarding/onboarding.types'
import { invitationParamsSchema, invitationRequestSchema } from '@financas/shared'
import { Hono } from 'hono'

const CREATED = 201
const NO_CONTENT = 204

export function invitationRoutes(deps: OnboardingRouteDeps) {
  const invitation = pathParams(invitationParamsSchema, 'INVITATION_NOT_FOUND')

  return new Hono<AppEnv>()
    .get('/', authorize('members', 'view'), async (c) => {
      return c.json(await listPendingInvitations(deps.db, currentWorkspace(c).workspaceId))
    })
    .post(
      '/',
      authorize('members', 'create'),
      jsonBody(invitationRequestSchema, 'INVITATION_INVALID'),
      async (c) => {
        const { workspaceId, roleKey } = currentWorkspace(c)
        const { userId } = currentSession(c)
        const request = c.req.valid('json')
        const issued = await inviteMember(
          deps.db,
          { workspaceId, inviterUserId: userId, inviterRoleKey: roleKey, request },
          deps,
        )
        if ('email' in request) {
          deps.background.run(c.get('logger'), 'onboarding.invitation_email', () =>
            sendInvitationEmail(
              deps.db,
              {
                workspaceId,
                inviterUserId: userId,
                email: request.email,
                inviteLink: issued.inviteLink,
              },
              deps,
            ),
          )
        }
        return c.json(issued, CREATED)
      },
    )
    .delete('/:invitationId', authorize('members', 'delete'), invitation, async (c) => {
      const { workspaceId } = currentWorkspace(c)
      const { userId } = currentSession(c)
      const { invitationId } = c.req.valid('param')
      await revokeInvitation(deps.db, { workspaceId, invitationId, userId })
      return c.body(null, NO_CONTENT)
    })
}
