import type { AppEnv } from '@api/core/http/http.types'
import { currentSession } from '@api/core/http/middleware/session'
import { jsonBody, pathParams } from '@api/core/http/validation'
import { authorize, currentWorkspace } from '@api/modules/access'
import {
  changeContact,
  createContact,
  deleteContact,
  listContacts,
} from '@api/modules/contacts/contacts.service'
import type { ContactRouteDeps } from '@api/modules/contacts/contacts.types'
import {
  contactChangeSchema,
  contactParamsSchema,
  deletionRequestSchema,
  newContactSchema,
} from '@financas/shared'
import { Hono } from 'hono'

const CREATED = 201
const NO_CONTENT = 204

export function contactRoutes({ db }: ContactRouteDeps) {
  const contact = pathParams(contactParamsSchema, 'CONTACT_NOT_FOUND')

  return new Hono<AppEnv>()
    .get('/', authorize('contacts', 'view'), async (c) => {
      return c.json(await listContacts(db, currentWorkspace(c).workspaceId))
    })
    .post(
      '/',
      authorize('contacts', 'create'),
      jsonBody(newContactSchema, 'CONTACT_INVALID'),
      async (c) => {
        const { workspaceId } = currentWorkspace(c)
        const { userId } = currentSession(c)
        return c.json(
          await createContact(db, { workspaceId, userId }, c.req.valid('json')),
          CREATED,
        )
      },
    )
    .patch(
      '/:contactId',
      authorize('contacts', 'update'),
      contact,
      jsonBody(contactChangeSchema, 'CONTACT_INVALID'),
      async (c) => {
        const { workspaceId } = currentWorkspace(c)
        const { contactId } = c.req.valid('param')
        await changeContact(db, { workspaceId, contactId }, c.req.valid('json'))
        return c.body(null, NO_CONTENT)
      },
    )
    .delete(
      '/:contactId',
      authorize('contacts', 'delete'),
      contact,
      jsonBody(deletionRequestSchema, 'DELETION_INVALID'),
      async (c) => {
        const { workspaceId } = currentWorkspace(c)
        const { userId } = currentSession(c)
        const { contactId } = c.req.valid('param')
        await deleteContact(db, {
          workspaceId,
          contactId,
          userId,
          reason: c.req.valid('json').reason,
        })
        return c.body(null, NO_CONTENT)
      },
    )
}
