import type { AppEnv } from '@api/core/http/http.types'
import { currentSession } from '@api/core/http/middleware/session'
import { jsonBody, pathParams, queryParams } from '@api/core/http/validation'
import { authorize, currentWorkspace } from '@api/modules/access'
import {
  cancelCharge,
  changeContact,
  createCharge,
  createContact,
  deleteContact,
  getCharge,
  getContact,
  listCharges,
  listContactBalances,
  listContacts,
  markChargeSent,
  payCharge,
} from '@api/modules/contacts/contacts.service'
import type { ContactRouteDeps } from '@api/modules/contacts/contacts.types'
import {
  chargeListQuerySchema,
  chargeParamsSchema,
  chargePaymentSchema,
  contactChangeSchema,
  contactParamsSchema,
  deletionRequestSchema,
  newChargeSchema,
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
    .get('/balances', authorize('contacts', 'view'), async (c) => {
      return c.json(await listContactBalances(db, currentWorkspace(c).workspaceId))
    })
    .get('/:contactId', authorize('contacts', 'view'), contact, async (c) => {
      const { workspaceId } = currentWorkspace(c)
      return c.json(await getContact(db, workspaceId, c.req.valid('param').contactId))
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
    .post(
      '/:contactId/charges',
      authorize('contacts', 'create'),
      contact,
      jsonBody(newChargeSchema, 'CHARGE_INVALID'),
      async (c) => {
        const { workspaceId } = currentWorkspace(c)
        const { userId } = currentSession(c)
        const { contactId } = c.req.valid('param')
        const created = await createCharge(
          db,
          { workspaceId, contactId },
          userId,
          c.req.valid('json'),
        )
        return c.json(created, CREATED)
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

export function chargeRoutes({ db }: ContactRouteDeps) {
  const charge = pathParams(chargeParamsSchema, 'CHARGE_NOT_FOUND')

  return new Hono<AppEnv>()
    .get(
      '/',
      authorize('contacts', 'view'),
      queryParams(chargeListQuerySchema, 'CHARGE_QUERY_INVALID'),
      async (c) => {
        const { workspaceId } = currentWorkspace(c)
        return c.json(await listCharges(db, workspaceId, c.req.valid('query').contactId))
      },
    )
    .get('/:chargeId', authorize('contacts', 'view'), charge, async (c) => {
      const { workspaceId } = currentWorkspace(c)
      return c.json(await getCharge(db, workspaceId, c.req.valid('param').chargeId))
    })
    .post('/:chargeId/sent', authorize('contacts', 'update'), charge, async (c) => {
      const { workspaceId } = currentWorkspace(c)
      await markChargeSent(db, { workspaceId, chargeId: c.req.valid('param').chargeId })
      return c.body(null, NO_CONTENT)
    })
    .post(
      '/:chargeId/payments',
      authorize('contacts', 'update'),
      charge,
      jsonBody(chargePaymentSchema, 'CHARGE_PAYMENT_INVALID'),
      async (c) => {
        const { workspaceId } = currentWorkspace(c)
        const { userId } = currentSession(c)
        const { chargeId } = c.req.valid('param')
        return c.json(
          await payCharge(db, { workspaceId, chargeId }, userId, c.req.valid('json')),
          CREATED,
        )
      },
    )
    .post('/:chargeId/cancel', authorize('contacts', 'update'), charge, async (c) => {
      const { workspaceId } = currentWorkspace(c)
      await cancelCharge(db, { workspaceId, chargeId: c.req.valid('param').chargeId })
      return c.body(null, NO_CONTENT)
    })
}
