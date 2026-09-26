import type { AppEnv } from '@api/core/http/http.types'
import { currentSession } from '@api/core/http/middleware/session'
import { jsonBody, pathParams, queryParams } from '@api/core/http/validation'
import { authorize, currentWorkspace } from '@api/modules/access'
import {
  archiveAccount,
  changeAccount,
  changeCard,
  changeEntryDetails,
  createAccount,
  createCard,
  deleteAccount,
  deleteEntry,
  listAccountBalances,
  listAccounts,
  listCards,
  listEntries,
  listInvoiceLines,
  listInvoiceTotals,
  listTrashedAccounts,
  listTrashedEntries,
  recordEntry,
  replaceEntry,
  restoreAccount,
  restoreEntry,
  unarchiveAccount,
} from '@api/modules/ledger/ledger.service'
import type { EntryContext, LedgerRouteDeps } from '@api/modules/ledger/ledger.types'
import {
  accountChangeSchema,
  accountParamsSchema,
  cardChangeSchema,
  cardParamsSchema,
  deletionRequestSchema,
  entryDetailsChangeSchema,
  entryInputSchema,
  entryListQuerySchema,
  entryParamsSchema,
  invoiceParamsSchema,
  newAccountSchema,
  newCardSchema,
  trashQuerySchema,
} from '@financas/shared'
import { type Context, Hono } from 'hono'

const CREATED = 201
const NO_CONTENT = 204
const ACCOUNT_NOT_FOUND = 'ACCOUNT_NOT_FOUND'
const CARD_NOT_FOUND = 'CARD_NOT_FOUND'
const ENTRY_NOT_FOUND = 'ENTRY_NOT_FOUND'
const ENTRY_INVALID = 'ENTRY_INVALID'
const WEB_SOURCE = 'web'

export function ledgerRoutes(deps: LedgerRouteDeps) {
  return new Hono<AppEnv>()
    .route('/accounts', accountRoutes(deps))
    .route('/cards', cardRoutes(deps))
    .route('/entries', entryRoutes(deps))
    .route('/balances', balanceRoutes(deps))
}

function accountRoutes({ db }: LedgerRouteDeps) {
  const account = pathParams(accountParamsSchema, ACCOUNT_NOT_FOUND)

  return new Hono<AppEnv>()
    .get('/', authorize('accounts', 'view'), async (c) => {
      return c.json(await listAccounts(db, currentWorkspace(c).workspaceId))
    })
    .get('/trash', authorize('accounts', 'delete'), async (c) => {
      return c.json(await listTrashedAccounts(db, currentWorkspace(c).workspaceId))
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
    .get(
      '/:cardId/invoices/:invoiceId/lines',
      authorize('cards', 'view'),
      pathParams(invoiceParamsSchema, 'INVOICE_NOT_FOUND'),
      async (c) => {
        const { workspaceId } = currentWorkspace(c)
        const { cardId, invoiceId } = c.req.valid('param')
        return c.json(await listInvoiceLines(db, { workspaceId, cardAccountId: cardId, invoiceId }))
      },
    )
}

function entryRoutes({ db }: LedgerRouteDeps) {
  const entry = pathParams(entryParamsSchema, ENTRY_NOT_FOUND)

  return new Hono<AppEnv>()
    .get(
      '/',
      authorize('entries', 'view'),
      queryParams(entryListQuerySchema, 'ENTRY_QUERY_INVALID'),
      async (c) => {
        const { workspaceId } = currentWorkspace(c)
        return c.json(await listEntries(db, workspaceId, c.req.valid('query')))
      },
    )
    .get(
      '/trash',
      authorize('entries', 'delete'),
      queryParams(trashQuerySchema, 'TRASH_QUERY_INVALID'),
      async (c) => {
        const { workspaceId } = currentWorkspace(c)
        return c.json(await listTrashedEntries(db, workspaceId, c.req.valid('query')))
      },
    )
    .post(
      '/',
      authorize('entries', 'create'),
      jsonBody(entryInputSchema, ENTRY_INVALID),
      async (c) => {
        const context = entryContextOf(c)
        return c.json(await recordEntry(db, context, c.req.valid('json')), CREATED)
      },
    )
    .put(
      '/:entryId',
      authorize('entries', 'update'),
      entry,
      jsonBody(entryInputSchema, ENTRY_INVALID),
      async (c) => {
        const { entryId } = c.req.valid('param')
        const replacement = await replaceEntry(db, entryContextOf(c), entryId, c.req.valid('json'))
        return c.json(replacement, CREATED)
      },
    )
    .patch(
      '/:entryId',
      authorize('entries', 'update'),
      entry,
      jsonBody(entryDetailsChangeSchema, ENTRY_INVALID),
      async (c) => {
        const { workspaceId } = currentWorkspace(c)
        const { entryId } = c.req.valid('param')
        await changeEntryDetails(db, { workspaceId, entryId }, c.req.valid('json'))
        return c.body(null, NO_CONTENT)
      },
    )
    .delete(
      '/:entryId',
      authorize('entries', 'delete'),
      entry,
      jsonBody(deletionRequestSchema, 'DELETION_INVALID'),
      async (c) => {
        const { workspaceId } = currentWorkspace(c)
        const { userId } = currentSession(c)
        const { entryId } = c.req.valid('param')
        await deleteEntry(db, { workspaceId, entryId, userId, reason: c.req.valid('json').reason })
        return c.body(null, NO_CONTENT)
      },
    )
    .post('/:entryId/restore', authorize('entries', 'delete'), entry, async (c) => {
      const { workspaceId } = currentWorkspace(c)
      await restoreEntry(db, { workspaceId, entryId: c.req.valid('param').entryId })
      return c.body(null, NO_CONTENT)
    })
}

function entryContextOf(c: Context<AppEnv>): EntryContext {
  return {
    workspaceId: currentWorkspace(c).workspaceId,
    userId: currentSession(c).userId,
    source: WEB_SOURCE,
  }
}

function balanceRoutes({ db }: LedgerRouteDeps) {
  return new Hono<AppEnv>().get('/', authorize('accounts', 'view'), async (c) => {
    return c.json(await listAccountBalances(db, currentWorkspace(c).workspaceId))
  })
}
