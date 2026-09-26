import type { AppEnv } from '@api/core/http/http.types'
import { currentSession } from '@api/core/http/middleware/session'
import { jsonBody, pathParams } from '@api/core/http/validation'
import { authorize, currentWorkspace } from '@api/modules/access'
import {
  archiveAccount,
  changeAccount,
  changeCard,
  createAccount,
  createCard,
  deleteAccount,
  listAccounts,
  listCards,
  listInvoiceTotals,
  restoreAccount,
  unarchiveAccount,
} from '@api/modules/ledger/ledger.service'
import type { LedgerRouteDeps } from '@api/modules/ledger/ledger.types'
import {
  accountChangeSchema,
  accountParamsSchema,
  cardChangeSchema,
  cardParamsSchema,
  deletionRequestSchema,
  newAccountSchema,
  newCardSchema,
} from '@financas/shared'
import { Hono } from 'hono'

const CREATED = 201
const NO_CONTENT = 204
const ACCOUNT_NOT_FOUND = 'ACCOUNT_NOT_FOUND'
const CARD_NOT_FOUND = 'CARD_NOT_FOUND'

export function ledgerRoutes(deps: LedgerRouteDeps) {
  return new Hono<AppEnv>()
    .route('/accounts', accountRoutes(deps))
    .route('/cards', cardRoutes(deps))
}

function accountRoutes({ db }: LedgerRouteDeps) {
  const account = pathParams(accountParamsSchema, ACCOUNT_NOT_FOUND)

  return new Hono<AppEnv>()
    .get('/', authorize('accounts', 'view'), async (c) => {
      return c.json(await listAccounts(db, currentWorkspace(c).workspaceId))
    })
    .post(
      '/',
      authorize('accounts', 'create'),
      jsonBody(newAccountSchema, 'ACCOUNT_INVALID'),
      async (c) => {
        const { workspaceId } = currentWorkspace(c)
        const { userId } = currentSession(c)
        const created = await createAccount(db, { workspaceId, userId }, c.req.valid('json'))
        return c.json(created, CREATED)
      },
    )
    .patch(
      '/:accountId',
      authorize('accounts', 'update'),
      account,
      jsonBody(accountChangeSchema, 'ACCOUNT_INVALID'),
      async (c) => {
        const { workspaceId } = currentWorkspace(c)
        const { accountId } = c.req.valid('param')
        await changeAccount(db, { workspaceId, accountId }, c.req.valid('json'))
        return c.body(null, NO_CONTENT)
      },
    )
    .post('/:accountId/archive', authorize('accounts', 'update'), account, async (c) => {
      const { workspaceId } = currentWorkspace(c)
      await archiveAccount(db, { workspaceId, accountId: c.req.valid('param').accountId })
      return c.body(null, NO_CONTENT)
    })
    .post('/:accountId/unarchive', authorize('accounts', 'update'), account, async (c) => {
      const { workspaceId } = currentWorkspace(c)
      await unarchiveAccount(db, { workspaceId, accountId: c.req.valid('param').accountId })
      return c.body(null, NO_CONTENT)
    })
    .delete(
      '/:accountId',
      authorize('accounts', 'delete'),
      account,
      jsonBody(deletionRequestSchema, 'DELETION_INVALID'),
      async (c) => {
        const { workspaceId } = currentWorkspace(c)
        const { userId } = currentSession(c)
        const { accountId } = c.req.valid('param')
        const { reason } = c.req.valid('json')
        await deleteAccount(db, { workspaceId, accountId, userId, reason })
        return c.body(null, NO_CONTENT)
      },
    )
    .post('/:accountId/restore', authorize('accounts', 'delete'), account, async (c) => {
      const { workspaceId } = currentWorkspace(c)
      await restoreAccount(db, { workspaceId, accountId: c.req.valid('param').accountId })
      return c.body(null, NO_CONTENT)
    })
}

function cardRoutes({ db }: LedgerRouteDeps) {
  const card = pathParams(cardParamsSchema, CARD_NOT_FOUND)

  return new Hono<AppEnv>()
    .get('/', authorize('cards', 'view'), async (c) => {
      return c.json(await listCards(db, currentWorkspace(c).workspaceId))
    })
    .post('/', authorize('cards', 'create'), jsonBody(newCardSchema, 'CARD_INVALID'), async (c) => {
      const { workspaceId } = currentWorkspace(c)
      const { userId } = currentSession(c)
      const created = await createCard(db, { workspaceId, userId }, c.req.valid('json'))
      return c.json(created, CREATED)
    })
    .patch(
      '/:cardId',
      authorize('cards', 'update'),
      card,
      jsonBody(cardChangeSchema, 'CARD_INVALID'),
      async (c) => {
        const { workspaceId } = currentWorkspace(c)
        const cardAccountId = c.req.valid('param').cardId
        await changeCard(db, { workspaceId, cardAccountId }, c.req.valid('json'))
        return c.body(null, NO_CONTENT)
      },
    )
    .get('/:cardId/invoices', authorize('cards', 'view'), card, async (c) => {
      const { workspaceId } = currentWorkspace(c)
      const cardAccountId = c.req.valid('param').cardId
      return c.json(await listInvoiceTotals(db, { workspaceId, cardAccountId }))
    })
}
