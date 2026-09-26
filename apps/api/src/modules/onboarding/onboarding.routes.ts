import type { AppEnv } from '@api/core/http/http.types'
import { currentSession } from '@api/core/http/middleware/session'
import { jsonBody, pathParams } from '@api/core/http/validation'
import { authorize, currentWorkspace } from '@api/modules/access'
import { limitInvalidLinks } from '@api/modules/identity'
import { listPendingInvitations, revokeInvitation } from '@api/modules/members'
import {
  acceptInvitationAsUser,
  inviteMember,
  previewInvitation,
  sendInvitationEmail,
} from '@api/modules/onboarding/onboarding.service'
import type { OnboardingRouteDeps } from '@api/modules/onboarding/onboarding.types'
import {
  invitationParamsSchema,
  invitationRequestSchema,
  invitationTokenRequestSchema,
} from '@financas/shared'
import { Hono } from 'hono'

const CREATED = 201
const NO_CONTENT = 204
const INVITATION_NOT_FOUND = 'INVITATION_NOT_FOUND'

export const PUBLIC_INVITATION_ROUTES = ['POST /api/invitations/preview'] as const

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
        const outcome = await inviteMember(
          deps.db,
          { workspaceId, inviterUserId: userId, inviterRoleKey: roleKey, request },
          deps,
        )
        const { emailToSend } = outcome
        if (emailToSend) {
          deps.background.run(c.get('logger'), 'onboarding.invitation_email', () =>
            sendInvitationEmail(deps.db, emailToSend, deps),
          )
        }
        return c.json(outcome.invitation, CREATED)
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

export function invitationResponseRoutes(deps: OnboardingRouteDeps) {
  const token = jsonBody(invitationTokenRequestSchema, 'INVITATION_INVALID')
  const limitInvalidInvitations = limitInvalidLinks(deps, [INVITATION_NOT_FOUND])

  return new Hono<AppEnv>()
    .post('/preview', token, limitInvalidInvitations, async (c) => {
      return c.json(await previewInvitation(deps.db, c.req.valid('json').token))
    })
    .post('/accept', token, limitInvalidInvitations, async (c) => {
      const { userId } = currentSession(c)
      const accepted = await acceptInvitationAsUser(deps.db, {
        token: c.req.valid('json').token,
        userId,
      })
      return c.json(accepted)
    })
}
