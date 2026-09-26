import { withWorkspace } from '@api/core/db/tx'
import {
  archiveAccount,
  changeAccount,
  changeCard,
  changeEntryDetails,
  createAccount,
  createCard,
  deleteAccount,
  deleteEntry,
  type EntryContext,
  listAccountBalances,
  listInvoiceTotals,
  recordEntry,
  replaceEntry,
  restoreAccount,
  restoreEntry,
  unarchiveAccount,
} from '@api/modules/ledger'
import {
  accountBalances,
  cardDetails,
  cardInvoices,
  journalEntries,
  ledgerAccounts,
  postings,
} from '@api/modules/ledger/ledger.table'
import { workspaces } from '@api/modules/workspaces/workspaces.table'
import {
  connectTestDatabases,
  POSTGRES_ERRORS,
  postgresErrorCodeOf,
  switchWorkspaceMidTransaction,
} from '@api/testing/database'
import { createFixtures } from '@api/testing/fixtures'
import type { NewAccount, NewEntry, NewInvoice, PostingLine } from '@api/testing/testing.types'
import { ACCOUNT_CLASS_BY_KIND, ACCOUNT_KINDS, type SystemAccountKind } from '@financas/shared'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const databases = connectTestDatabases()
const fixtures = createFixtures(databases.owner, databases.app)

let ownerUserId: string
let workspaceA: string
let workspaceB: string

beforeAll(async () => {
  ownerUserId = await fixtures.createUser('ledger')
  workspaceA = (await fixtures.createWorkspaceOwnedBy(ownerUserId, 'A')).workspaceId
  workspaceB = (await fixtures.createWorkspaceOwnedBy(ownerUserId, 'B')).workspaceId
})

afterAll(async () => {
  await fixtures.removeEverything()
  await databases.closeAll()
})

function uniqueName(label: string): string {
  return `${label} ${crypto.randomUUID()}`
}

async function insertAccount(account: NewAccount, workspaceId = workspaceA): Promise<string> {
  const [inserted] = await withWorkspace(databases.app, workspaceId, (tx) =>
    tx
      .insert(ledgerAccounts)
      .values({
        workspaceId,
        name: uniqueName(account.kind),
        currency: 'BRL',
        incomeNature: account.kind === 'income_category' ? 'fixed' : null,
        ...account,
      })
      .returning({ id: ledgerAccounts.id }),
  )
  if (!inserted) {
    throw new Error('Could not insert the account')
  }
  return inserted.id
}

function insertOutcome(account: NewAccount, workspaceId = workspaceA) {
  return postgresErrorCodeOf(insertAccount(account, workspaceId))
}

describe('ledger_accounts', () => {
  it('are isolated per workspace', async () => {
    const accountInB = await insertAccount({ kind: 'checking' }, workspaceB)
    const seenFromA = await withWorkspace(databases.app, workspaceA, (tx) =>
      tx.select().from(ledgerAccounts).where(eq(ledgerAccounts.id, accountInB)),
    )
    expect(seenFromA).toEqual([])
  })

  it('derive the class of every kind from the shared mapping', async () => {
    const workspaceId = (await fixtures.createWorkspaceOwnedBy(ownerUserId, 'Kinds')).workspaceId
    const existing = await withWorkspace(databases.app, workspaceId, (tx) =>
      tx.select({ kind: ledgerAccounts.kind }).from(ledgerAccounts),
    )
    const existingKinds = new Set(existing.map((account) => account.kind))
    for (const kind of ACCOUNT_KINDS.filter((candidate) => !existingKinds.has(candidate))) {
      await insertAccount({ kind }, workspaceId)
    }

    const stored = await withWorkspace(databases.app, workspaceId, (tx) =>
      tx.select({ kind: ledgerAccounts.kind, class: ledgerAccounts.class }).from(ledgerAccounts),
    )
    expect(Object.fromEntries(stored.map((account) => [account.kind, account.class]))).toEqual(
      ACCOUNT_CLASS_BY_KIND,
    )
  })

  it('nest only under a parent of the same class', async () => {
    const food = await insertAccount({ kind: 'expense_category' })
    expect(await insertOutcome({ kind: 'expense_category', parentId: food })).toBeUndefined()
    expect(await insertOutcome({ kind: 'income_category', parentId: food })).toBe(
      POSTGRES_ERRORS.foreignKeyViolation,
    )
  })

  it('nest only under a parent of the same workspace', async () => {
    const parentInB = await insertAccount({ kind: 'expense_category' }, workspaceB)
    expect(await insertOutcome({ kind: 'expense_category', parentId: parentInB })).toBe(
      POSTGRES_ERRORS.foreignKeyViolation,
    )
  })

  it('refuse being their own parent', async () => {
    const id = crypto.randomUUID()
    expect(await insertOutcome({ id, kind: 'expense_category', parentId: id })).toBe(
      POSTGRES_ERRORS.checkViolation,
    )
  })

  it('keep sibling names unique regardless of case, until one is deleted', async () => {
    const parentId = await insertAccount({ kind: 'expense_category' })
    const name = uniqueName('Mercado')
    const firstId = await insertAccount({ kind: 'expense_category', parentId, name })
    expect(
      await insertOutcome({ kind: 'expense_category', parentId, name: name.toUpperCase() }),
    ).toBe(POSTGRES_ERRORS.uniqueViolation)
    expect(await insertOutcome({ kind: 'expense_category', name })).toBeUndefined()

    await withWorkspace(databases.app, workspaceA, (tx) =>
      tx
        .update(ledgerAccounts)
        .set({ deletedAt: new Date() })
        .where(eq(ledgerAccounts.id, firstId)),
    )
    expect(await insertOutcome({ kind: 'expense_category', parentId, name })).toBeUndefined()
  })

  it('keep root names unique within a class', async () => {
    const name = uniqueName('Reserva')
    await insertAccount({ kind: 'savings', name })
    expect(await insertOutcome({ kind: 'checking', name })).toBe(POSTGRES_ERRORS.uniqueViolation)
    expect(await insertOutcome({ kind: 'expense_category', name })).toBeUndefined()
  })

  it('require an income nature exactly on income categories', async () => {
    expect(await insertOutcome({ kind: 'income_category', incomeNature: null })).toBe(
      POSTGRES_ERRORS.checkViolation,
    )
    expect(await insertOutcome({ kind: 'income_category', incomeNature: 'variable' })).toBe(
      undefined,
    )
    expect(await insertOutcome({ kind: 'checking', incomeNature: 'fixed' })).toBe(
      POSTGRES_ERRORS.checkViolation,
    )
  })

  it('reject a currency that is not an ISO code', async () => {
    expect(await insertOutcome({ kind: 'checking', currency: 'brl' })).toBe(
      POSTGRES_ERRORS.checkViolation,
    )
  })

  it('allow one system account per kind, always at the root', async () => {
    const workspaceId = (await fixtures.createWorkspaceOwnedBy(ownerUserId, 'System')).workspaceId
    const [receivable] = await withWorkspace(databases.app, workspaceId, (tx) =>
      tx
        .select({ id: ledgerAccounts.id, isSystem: ledgerAccounts.isSystem })
        .from(ledgerAccounts)
        .where(eq(ledgerAccounts.kind, 'receivable')),
    )
    const receivableId =
      receivable?.id ?? (await insertAccount({ kind: 'receivable' }, workspaceId))

    expect(await insertOutcome({ kind: 'receivable' }, workspaceId)).toBe(
      POSTGRES_ERRORS.uniqueViolation,
    )
    const assetParent = await insertAccount({ kind: 'checking' }, workspaceId)
    expect(await insertOutcome({ kind: 'payable', parentId: assetParent }, workspaceId)).toBe(
      POSTGRES_ERRORS.checkViolation,
    )
    const [stored] = await withWorkspace(databases.app, workspaceId, (tx) =>
      tx
        .select({ isSystem: ledgerAccounts.isSystem })
        .from(ledgerAccounts)
        .where(eq(ledgerAccounts.id, receivableId)),
    )
    expect(stored?.isSystem).toBe(true)
  })
})

function updateAccount(
  accountId: string,
  changes: Partial<typeof ledgerAccounts.$inferInsert>,
  workspaceId = workspaceA,
) {
  return withWorkspace(databases.app, workspaceId, (tx) =>
    tx.update(ledgerAccounts).set(changes).where(eq(ledgerAccounts.id, accountId)),
  )
}

function updateOutcome(
  accountId: string,
  changes: Partial<typeof ledgerAccounts.$inferInsert>,
  workspaceId = workspaceA,
) {
  return postgresErrorCodeOf(updateAccount(accountId, changes, workspaceId))
}

async function systemAccountOf(workspaceId: string, kind: SystemAccountKind): Promise<string> {
  const [existing] = await withWorkspace(databases.app, workspaceId, (tx) =>
    tx.select({ id: ledgerAccounts.id }).from(ledgerAccounts).where(eq(ledgerAccounts.kind, kind)),
  )
  return existing?.id ?? insertAccount({ kind }, workspaceId)
}

describe('account tree', () => {
  it('refuses a cycle', async () => {
    const grandparent = await insertAccount({ kind: 'expense_category' })
    const parent = await insertAccount({ kind: 'expense_category', parentId: grandparent })
    const child = await insertAccount({ kind: 'expense_category', parentId: parent })
    expect(await updateOutcome(grandparent, { parentId: child })).toBe(
      POSTGRES_ERRORS.checkViolation,
    )
  })

  it('still allows moving an account to another branch', async () => {
    const branchA = await insertAccount({ kind: 'expense_category' })
    const branchB = await insertAccount({ kind: 'expense_category' })
    const leaf = await insertAccount({ kind: 'expense_category', parentId: branchA })
    expect(await updateOutcome(leaf, { parentId: branchB })).toBeUndefined()
  })

  it('refuses deleting an account that has active children, until they are deleted', async () => {
    const parent = await insertAccount({ kind: 'expense_category' })
    const child = await insertAccount({ kind: 'expense_category', parentId: parent })
    expect(await updateOutcome(parent, { deletedAt: new Date() })).toBe(
      POSTGRES_ERRORS.checkViolation,
    )
    await updateAccount(child, { deletedAt: new Date() })
    expect(await updateOutcome(parent, { deletedAt: new Date() })).toBeUndefined()
  })

  it('refuses a child, new or restored, under a deleted parent', async () => {
    const parent = await insertAccount({ kind: 'expense_category' })
    const child = await insertAccount({ kind: 'expense_category', parentId: parent })
    await updateAccount(child, { deletedAt: new Date() })
    await updateAccount(parent, { deletedAt: new Date() })

    expect(await insertOutcome({ kind: 'expense_category', parentId: parent })).toBe(
      POSTGRES_ERRORS.checkViolation,
    )
    expect(await updateOutcome(child, { deletedAt: null })).toBe(POSTGRES_ERRORS.checkViolation)
  })
})

describe('workspace erasure', () => {
  it('still removes a workspace with a nested account tree', async () => {
    const workspaceId = (await fixtures.createWorkspaceOwnedBy(ownerUserId, 'Erase')).workspaceId
    const parentId = await insertAccount({ kind: 'expense_category' }, workspaceId)
    await insertAccount({ kind: 'expense_category', parentId }, workspaceId)
    await systemAccountOf(workspaceId, 'receivable')

    const erase = databases.owner.delete(workspaces).where(eq(workspaces.id, workspaceId))
    expect(await postgresErrorCodeOf(erase)).toBeUndefined()
  })
})

describe('system accounts', () => {
  let receivable: string

  beforeAll(async () => {
    receivable = await systemAccountOf(workspaceA, 'receivable')
  })

  it.each([
    ['renamed', { name: 'Renamed' }],
    ['archived', { archivedAt: new Date() }],
    ['deleted', { deletedAt: new Date() }],
    ['turned into another kind', { kind: 'checking' as const }],
  ])('cannot be %s', async (_change, changes) => {
    expect(await updateOutcome(receivable, changes)).toBe(POSTGRES_ERRORS.checkViolation)
  })

  it('can still be personalized', async () => {
    expect(await updateOutcome(receivable, { color: '#00aa00', sortOrder: 9 })).toBeUndefined()
  })
})

const ENTRY_DATE = '2026-10-01'

async function recordRaw(
  lines: PostingLine[],
  entry: NewEntry = {},
  workspaceId = workspaceA,
): Promise<string> {
  return withWorkspace(databases.app, workspaceId, async (tx) => {
    const [inserted] = await tx
      .insert(journalEntries)
      .values({
        workspaceId,
        occurredOn: ENTRY_DATE,
        description: 'Mercado',
        entryType: 'expense',
        source: 'web',
        createdByUserId: ownerUserId,
        ...entry,
      })
      .returning({ id: journalEntries.id })
    if (!inserted) {
      throw new Error('Could not insert the entry')
    }
    if (lines.length > 0) {
      await tx.insert(postings).values(
        lines.map((line, index) => ({
          workspaceId,
          entryId: inserted.id,
          lineNo: line.lineNo ?? index + 1,
          accountId: line.accountId,
          accountKind: line.kind,
          amountCents: line.amountCents,
          effectiveOn: ENTRY_DATE,
          invoiceId: line.invoiceId ?? null,
        })),
      )
    }
    return inserted.id
  })
}

function recordOutcome(lines: PostingLine[], entry: NewEntry = {}, workspaceId = workspaceA) {
  return postgresErrorCodeOf(recordRaw(lines, entry, workspaceId))
}

function spend(amountCents: number, from: string, on: string): PostingLine[] {
  return [
    { accountId: on, kind: 'expense_category', amountCents },
    { accountId: from, kind: 'checking', amountCents: -amountCents },
  ]
}

describe('journal entries and postings', () => {
  let checking: string
  let groceries: string

  beforeAll(async () => {
    checking = await insertAccount({ kind: 'checking' })
    groceries = await insertAccount({ kind: 'expense_category' })
  })

  it('record an entry with its postings', async () => {
    const entryId = await recordRaw(spend(8750, checking, groceries))
    const lines = await withWorkspace(databases.app, workspaceA, (tx) =>
      tx
        .select({ amountCents: postings.amountCents, lineNo: postings.lineNo })
        .from(postings)
        .where(eq(postings.entryId, entryId)),
    )
    expect(lines).toEqual([
      { amountCents: 8750, lineNo: 1 },
      { amountCents: -8750, lineNo: 2 },
    ])
  })

  it('are isolated per workspace', async () => {
    const checkingInB = await insertAccount({ kind: 'checking' }, workspaceB)
    const groceriesInB = await insertAccount({ kind: 'expense_category' }, workspaceB)
    const entryInB = await recordRaw(spend(1000, checkingInB, groceriesInB), {}, workspaceB)
    const seenFromA = await withWorkspace(databases.app, workspaceA, async (tx) => ({
      entries: await tx.select().from(journalEntries).where(eq(journalEntries.id, entryInB)),
      postings: await tx.select().from(postings).where(eq(postings.entryId, entryInB)),
    }))
    expect(seenFromA).toEqual({ entries: [], postings: [] })
  })

  it('refuse a posting on an account of another workspace', async () => {
    const checkingInB = await insertAccount({ kind: 'checking' }, workspaceB)
    expect(await recordOutcome(spend(1000, checkingInB, groceries))).toBe(
      POSTGRES_ERRORS.foreignKeyViolation,
    )
  })

  it('refuse a posting whose kind is not the account kind', async () => {
    const wrongKind: PostingLine[] = [
      { accountId: groceries, kind: 'income_category', amountCents: 1000 },
      { accountId: checking, kind: 'checking', amountCents: -1000 },
    ]
    expect(await recordOutcome(wrongKind)).toBe(POSTGRES_ERRORS.foreignKeyViolation)
  })

  it('refuse a zero amount', async () => {
    const zero: PostingLine[] = [
      { accountId: groceries, kind: 'expense_category', amountCents: 0 },
      { accountId: checking, kind: 'checking', amountCents: 0 },
    ]
    expect(await recordOutcome(zero)).toBe(POSTGRES_ERRORS.checkViolation)
  })

  it('refuse two postings with the same line number', async () => {
    const [first, second] = spend(1000, checking, groceries)
    if (!first || !second) {
      throw new Error('spend() builds two lines')
    }
    expect(await recordOutcome([first, { ...second, lineNo: 1 }])).toBe(
      POSTGRES_ERRORS.uniqueViolation,
    )
  })

  it('refuse postings on receivables and payables until their contact column exists', async () => {
    const receivable = await systemAccountOf(workspaceA, 'receivable')
    const onReceivable: PostingLine[] = [
      { accountId: receivable, kind: 'receivable', amountCents: 1000 },
      { accountId: checking, kind: 'checking', amountCents: -1000 },
    ]
    expect(await recordOutcome(onReceivable)).toBe(POSTGRES_ERRORS.checkViolation)
  })

  it('keep external references unique per workspace', async () => {
    const externalRef = crypto.randomUUID()
    await recordRaw(spend(1000, checking, groceries), { externalRef })
    expect(await recordOutcome(spend(1000, checking, groceries), { externalRef })).toBe(
      POSTGRES_ERRORS.uniqueViolation,
    )
  })

  it('keep the kind of an account once it has postings', async () => {
    const wallet = await insertAccount({ kind: 'cash_wallet' })
    await recordRaw([
      { accountId: groceries, kind: 'expense_category', amountCents: 500 },
      { accountId: wallet, kind: 'cash_wallet', amountCents: -500 },
    ])
    expect(await updateOutcome(wallet, { kind: 'checking' })).toBe(
      POSTGRES_ERRORS.foreignKeyViolation,
    )
  })

  it('keep an account with postings from being hard deleted', async () => {
    const wallet = await insertAccount({ kind: 'cash_wallet' })
    await recordRaw([
      { accountId: groceries, kind: 'expense_category', amountCents: 700 },
      { accountId: wallet, kind: 'cash_wallet', amountCents: -700 },
    ])
    const hardDelete = withWorkspace(databases.app, workspaceA, (tx) =>
      tx.delete(ledgerAccounts).where(eq(ledgerAccounts.id, wallet)),
    )
    expect(await postgresErrorCodeOf(hardDelete)).toBe(POSTGRES_ERRORS.foreignKeyViolation)
  })

  it('go away with the workspace when it is erased', async () => {
    const workspaceId = (await fixtures.createWorkspaceOwnedBy(ownerUserId, 'Erase entries'))
      .workspaceId
    const wallet = await insertAccount({ kind: 'checking' }, workspaceId)
    const food = await insertAccount({ kind: 'expense_category' }, workspaceId)
    const entryId = await recordRaw(spend(1000, wallet, food), {}, workspaceId)

    const erase = databases.owner.delete(workspaces).where(eq(workspaces.id, workspaceId))
    expect(await postgresErrorCodeOf(erase)).toBeUndefined()
    const leftovers = await databases.owner
      .select()
      .from(postings)
      .where(inArray(postings.entryId, [entryId]))
    expect(leftovers).toEqual([])
  })
})

describe('ledger invariants', () => {
  let checking: string
  let groceries: string

  beforeAll(async () => {
    checking = await insertAccount({ kind: 'checking' })
    groceries = await insertAccount({ kind: 'expense_category' })
  })

  function changeEntry(entryId: string, changes: NewEntry) {
    return postgresErrorCodeOf(
      withWorkspace(databases.app, workspaceA, (tx) =>
        tx.update(journalEntries).set(changes).where(eq(journalEntries.id, entryId)),
      ),
    )
  }

  it('refuse an entry whose postings do not sum to zero', async () => {
    const unbalanced: PostingLine[] = [
      { accountId: groceries, kind: 'expense_category', amountCents: 1000 },
      { accountId: checking, kind: 'checking', amountCents: -900 },
    ]
    expect(await recordOutcome(unbalanced)).toBe(POSTGRES_ERRORS.checkViolation)
  })

  it('refuse an entry with fewer than two postings', async () => {
    expect(await recordOutcome([])).toBe(POSTGRES_ERRORS.checkViolation)
    const single: PostingLine[] = [
      { accountId: groceries, kind: 'expense_category', amountCents: 1000 },
    ]
    expect(await recordOutcome(single)).toBe(POSTGRES_ERRORS.checkViolation)
  })

  it('accept a balanced entry with several postings', async () => {
    const split: PostingLine[] = [
      { accountId: groceries, kind: 'expense_category', amountCents: 600 },
      { accountId: groceries, kind: 'expense_category', amountCents: 400 },
      { accountId: checking, kind: 'checking', amountCents: -1000 },
    ]
    expect(await recordOutcome(split)).toBeUndefined()
  })

  it('refuse an unbalanced entry even if the transaction switches workspace', async () => {
    const unbalancedThenSwitch = withWorkspace(databases.app, workspaceA, async (tx) => {
      const [entry] = await tx
        .insert(journalEntries)
        .values({
          workspaceId: workspaceA,
          occurredOn: ENTRY_DATE,
          description: 'Mercado',
          entryType: 'expense',
          source: 'web',
          createdByUserId: ownerUserId,
        })
        .returning({ id: journalEntries.id })
      if (!entry) {
        throw new Error('Could not insert the entry')
      }
      await tx.insert(postings).values({
        workspaceId: workspaceA,
        entryId: entry.id,
        lineNo: 1,
        accountId: groceries,
        accountKind: 'expense_category',
        amountCents: 1000,
        effectiveOn: ENTRY_DATE,
      })
      await switchWorkspaceMidTransaction(tx, workspaceB)
    })
    expect(await postgresErrorCodeOf(unbalancedThenSwitch)).toBe(POSTGRES_ERRORS.checkViolation)
  })

  it('keep postings immutable: no update, no delete, no new line later', async () => {
    const entryId = await recordRaw(spend(1000, checking, groceries))
    const changeAmount = withWorkspace(databases.app, workspaceA, (tx) =>
      tx.update(postings).set({ amountCents: 2000 }).where(eq(postings.entryId, entryId)),
    )
    expect(await postgresErrorCodeOf(changeAmount)).toBe(POSTGRES_ERRORS.checkViolation)

    const removeLines = withWorkspace(databases.app, workspaceA, (tx) =>
      tx.delete(postings).where(eq(postings.entryId, entryId)),
    )
    expect(await postgresErrorCodeOf(removeLines)).toBe(POSTGRES_ERRORS.checkViolation)

    const addBalancedPairLater = withWorkspace(databases.app, workspaceA, (tx) =>
      tx.insert(postings).values(
        spend(500, checking, groceries).map((line, index) => ({
          workspaceId: workspaceA,
          entryId,
          lineNo: index + 3,
          accountId: line.accountId,
          accountKind: line.kind,
          amountCents: line.amountCents,
          effectiveOn: ENTRY_DATE,
        })),
      ),
    )
    expect(await postgresErrorCodeOf(addBalancedPairLater)).toBe(POSTGRES_ERRORS.checkViolation)
  })

  it('let an entry change only its description and notes in place', async () => {
    const entryId = await recordRaw(spend(1000, checking, groceries))
    expect(await changeEntry(entryId, { description: 'Feira', notes: 'semana 1' })).toBeUndefined()
    expect(await changeEntry(entryId, { occurredOn: '2026-10-02' })).toBe(
      POSTGRES_ERRORS.checkViolation,
    )
    expect(await changeEntry(entryId, { entryType: 'income' })).toBe(POSTGRES_ERRORS.checkViolation)
  })

  it('let an entry be soft deleted and restored, never hard deleted', async () => {
    const entryId = await recordRaw(spend(1000, checking, groceries))
    expect(await changeEntry(entryId, { deletedAt: new Date(), deleteReason: 'engano' })).toBe(
      undefined,
    )
    expect(await changeEntry(entryId, { deletedAt: null, deleteReason: null })).toBeUndefined()

    const hardDelete = withWorkspace(databases.app, workspaceA, (tx) =>
      tx.delete(journalEntries).where(eq(journalEntries.id, entryId)),
    )
    expect(await postgresErrorCodeOf(hardDelete)).toBe(POSTGRES_ERRORS.checkViolation)
  })

  it('refuse postings on an archived or a deleted account', async () => {
    const archived = await insertAccount({ kind: 'checking', archivedAt: new Date() })
    expect(await recordOutcome(spend(1000, archived, groceries))).toBe(
      POSTGRES_ERRORS.checkViolation,
    )
    const deleted = await insertAccount({ kind: 'checking', deletedAt: new Date() })
    expect(await recordOutcome(spend(1000, deleted, groceries))).toBe(
      POSTGRES_ERRORS.checkViolation,
    )
  })

  it('refuse deleting an account used by active entries, but allow archiving it', async () => {
    const wallet = await insertAccount({ kind: 'checking' })
    const entryId = await recordRaw(spend(1000, wallet, groceries))
    expect(await updateOutcome(wallet, { deletedAt: new Date() })).toBe(
      POSTGRES_ERRORS.checkViolation,
    )
    expect(await updateOutcome(wallet, { archivedAt: new Date() })).toBeUndefined()

    expect(await changeEntry(entryId, { deletedAt: new Date() })).toBeUndefined()
    expect(await updateOutcome(wallet, { deletedAt: new Date() })).toBeUndefined()
    expect(await changeEntry(entryId, { deletedAt: null })).toBe(POSTGRES_ERRORS.checkViolation)
  })
})

describe('entry replacement', () => {
  let checking: string
  let groceries: string

  beforeAll(async () => {
    checking = await insertAccount({ kind: 'checking' })
    groceries = await insertAccount({ kind: 'expense_category' })
  })

  function replaceRaw(oldEntryId: string, { deleteOld = true } = {}) {
    return withWorkspace(databases.app, workspaceA, async (tx) => {
      if (deleteOld) {
        await tx
          .update(journalEntries)
          .set({ deletedAt: new Date() })
          .where(eq(journalEntries.id, oldEntryId))
      }
      const [replacement] = await tx
        .insert(journalEntries)
        .values({
          workspaceId: workspaceA,
          occurredOn: ENTRY_DATE,
          description: 'Mercado (corrigido)',
          entryType: 'expense',
          source: 'web',
          createdByUserId: ownerUserId,
          replacesEntryId: oldEntryId,
        })
        .returning({ id: journalEntries.id })
      if (!replacement) {
        throw new Error('Could not insert the replacement')
      }
      await tx.insert(postings).values(
        spend(1200, checking, groceries).map((line, index) => ({
          workspaceId: workspaceA,
          entryId: replacement.id,
          lineNo: index + 1,
          accountId: line.accountId,
          accountKind: line.kind,
          amountCents: line.amountCents,
          effectiveOn: ENTRY_DATE,
        })),
      )
      return replacement.id
    })
  }

  function setDeleted(entryId: string, deleted: boolean) {
    return postgresErrorCodeOf(
      withWorkspace(databases.app, workspaceA, (tx) =>
        tx
          .update(journalEntries)
          .set({ deletedAt: deleted ? new Date() : null })
          .where(eq(journalEntries.id, entryId)),
      ),
    )
  }

  it('accepts deleting the old entry and adding its replacement together', async () => {
    const original = await recordRaw(spend(1000, checking, groceries))
    expect(await postgresErrorCodeOf(replaceRaw(original))).toBeUndefined()
  })

  it('refuses a replacement while the old entry stays active', async () => {
    const original = await recordRaw(spend(1000, checking, groceries))
    expect(await postgresErrorCodeOf(replaceRaw(original, { deleteOld: false }))).toBe(
      POSTGRES_ERRORS.checkViolation,
    )
  })

  it('refuses restoring a replaced entry while its replacement is active', async () => {
    const original = await recordRaw(spend(1000, checking, groceries))
    await replaceRaw(original)
    expect(await setDeleted(original, false)).toBe(POSTGRES_ERRORS.checkViolation)
  })

  it('refuses restoring a replacement once the original came back', async () => {
    const original = await recordRaw(spend(1000, checking, groceries))
    const replacement = await replaceRaw(original)
    expect(await setDeleted(replacement, true)).toBeUndefined()
    expect(await setDeleted(original, false)).toBeUndefined()
    expect(await setDeleted(replacement, false)).toBe(POSTGRES_ERRORS.checkViolation)
  })

  it('allows only one active replacement per entry', async () => {
    const original = await recordRaw(spend(1000, checking, groceries))
    await replaceRaw(original)
    expect(await postgresErrorCodeOf(replaceRaw(original, { deleteOld: false }))).toBe(
      POSTGRES_ERRORS.uniqueViolation,
    )
  })
})

async function postingsOf(entryId: string, workspaceId = workspaceA) {
  const lines = await withWorkspace(databases.app, workspaceId, (tx) =>
    tx
      .select({ accountId: postings.accountId, amountCents: postings.amountCents })
      .from(postings)
      .where(eq(postings.entryId, entryId))
      .orderBy(asc(postings.lineNo)),
  )
  return lines.map((line) => [line.accountId, line.amountCents])
}

async function entryRow(entryId: string, workspaceId = workspaceA) {
  const [entry] = await withWorkspace(databases.app, workspaceId, (tx) =>
    tx.select().from(journalEntries).where(eq(journalEntries.id, entryId)),
  )
  return entry
}

describe('recordEntry', () => {
  let context: EntryContext
  let checking: string
  let savings: string
  let groceries: string
  let salary: string

  beforeAll(async () => {
    context = { workspaceId: workspaceA, userId: ownerUserId, source: 'whatsapp' }
    checking = await insertAccount({ kind: 'checking' })
    savings = await insertAccount({ kind: 'savings' })
    groceries = await insertAccount({ kind: 'expense_category' })
    salary = await insertAccount({ kind: 'income_category' })
  })

  const details = { occurredOn: '2026-10-05', description: '  Mercado  ' }

  it('records an expense with its postings and details', async () => {
    const { entryId } = await recordEntry(databases.app, context, {
      ...details,
      entryType: 'expense',
      amountCents: 8750,
      paymentMethod: 'pix',
      paidFromAccountId: checking,
      categoryId: groceries,
    })

    expect(await postingsOf(entryId)).toEqual([
      [groceries, 8750],
      [checking, -8750],
    ])
    expect(await entryRow(entryId)).toMatchObject({
      entryType: 'expense',
      description: 'Mercado',
      occurredOn: '2026-10-05',
      paymentMethod: 'pix',
      source: 'whatsapp',
      createdByUserId: ownerUserId,
      replacesEntryId: null,
    })
  })

  it('records income and a transfer', async () => {
    const income = await recordEntry(databases.app, context, {
      ...details,
      entryType: 'income',
      amountCents: 500000,
      receivedInAccountId: checking,
      categoryId: salary,
    })
    const transfer = await recordEntry(databases.app, context, {
      ...details,
      entryType: 'transfer',
      amountCents: 100000,
      fromAccountId: checking,
      toAccountId: savings,
    })
    expect(await postingsOf(income.entryId)).toEqual([
      [checking, 500000],
      [salary, -500000],
    ])
    expect(await postingsOf(transfer.entryId)).toEqual([
      [savings, 100000],
      [checking, -100000],
    ])
  })

  it('records an opening balance against the system account', async () => {
    const openingBalance = await systemAccountOf(workspaceA, 'opening_balance')
    const { entryId } = await recordEntry(databases.app, context, {
      ...details,
      entryType: 'opening_balance',
      balanceCents: 200000,
      accountId: savings,
    })
    expect(await postingsOf(entryId)).toEqual([
      [savings, 200000],
      [openingBalance, -200000],
    ])
  })

  it('records who spent when that person is a member', async () => {
    const { entryId } = await recordEntry(databases.app, context, {
      ...details,
      entryType: 'expense',
      amountCents: 300,
      spentByUserId: ownerUserId,
      paidFromAccountId: checking,
      categoryId: groceries,
    })
    expect((await entryRow(entryId))?.spentByUserId).toBe(ownerUserId)
  })

  it('refuses a spender who is not a member of the workspace', async () => {
    const outsider = await fixtures.createUser('outsider')
    const recorded = recordEntry(databases.app, context, {
      ...details,
      entryType: 'expense',
      amountCents: 300,
      spentByUserId: outsider,
      paidFromAccountId: checking,
      categoryId: groceries,
    })
    await expect(recorded).rejects.toMatchObject({ code: 'SPENT_BY_NOT_A_MEMBER' })
  })

  it('refuses input that does not match the schema', async () => {
    const recorded = recordEntry(databases.app, context, {
      ...details,
      entryType: 'expense',
      amountCents: 87.5,
      paidFromAccountId: checking,
      categoryId: groceries,
    })
    await expect(recorded).rejects.toMatchObject({ code: 'ENTRY_INVALID' })
  })

  it('refuses a category of the wrong kind', async () => {
    const recorded = recordEntry(databases.app, context, {
      ...details,
      entryType: 'expense',
      amountCents: 100,
      paidFromAccountId: checking,
      categoryId: salary,
    })
    await expect(recorded).rejects.toMatchObject({ code: 'NOT_AN_EXPENSE_CATEGORY' })
  })

  it('refuses an account from another workspace, archived or deleted', async () => {
    const elsewhere = await insertAccount({ kind: 'checking' }, workspaceB)
    const archived = await insertAccount({ kind: 'checking', archivedAt: new Date() })
    const deleted = await insertAccount({ kind: 'checking', deletedAt: new Date() })
    for (const unavailable of [elsewhere, archived, deleted]) {
      const recorded = recordEntry(databases.app, context, {
        ...details,
        entryType: 'expense',
        amountCents: 100,
        paidFromAccountId: unavailable,
        categoryId: groceries,
      })
      await expect(recorded).rejects.toMatchObject({ code: 'ACCOUNT_NOT_AVAILABLE' })
    }
  })
})

describe('changing, deleting, restoring and replacing entries', () => {
  let context: EntryContext
  let checking: string
  let groceries: string

  beforeAll(async () => {
    context = { workspaceId: workspaceA, userId: ownerUserId, source: 'web' }
    checking = await insertAccount({ kind: 'checking' })
    groceries = await insertAccount({ kind: 'expense_category' })
  })

  function expenseOf(amountCents: number) {
    return {
      entryType: 'expense',
      occurredOn: '2026-10-06',
      description: 'Padaria',
      amountCents,
      paidFromAccountId: checking,
      categoryId: groceries,
    }
  }

  async function recordExpense(amountCents = 1500): Promise<string> {
    return (await recordEntry(databases.app, context, expenseOf(amountCents))).entryId
  }

  const refOf = (entryId: string) => ({ workspaceId: workspaceA, entryId })

  it('changes the description and notes in place', async () => {
    const entryId = await recordExpense()
    await changeEntryDetails(databases.app, refOf(entryId), {
      description: 'Padaria do bairro',
      notes: 'pão e leite',
    })
    expect(await entryRow(entryId)).toMatchObject({
      description: 'Padaria do bairro',
      notes: 'pão e leite',
    })
  })

  it('refuses an empty change and a change to a deleted entry', async () => {
    const entryId = await recordExpense()
    await expect(changeEntryDetails(databases.app, refOf(entryId), {})).rejects.toMatchObject({
      code: 'ENTRY_INVALID',
    })
    await deleteEntry(databases.app, { ...refOf(entryId), userId: ownerUserId })
    await expect(
      changeEntryDetails(databases.app, refOf(entryId), { description: 'x' }),
    ).rejects.toMatchObject({ code: 'ENTRY_ALREADY_DELETED' })
  })

  it('soft deletes an entry, recording who, when and why', async () => {
    const entryId = await recordExpense()
    const deletedAt = new Date('2026-10-07T12:00:00Z')
    await deleteEntry(
      databases.app,
      { ...refOf(entryId), userId: ownerUserId, reason: 'duplicado' },
      { now: () => deletedAt },
    )
    expect(await entryRow(entryId)).toMatchObject({
      deletedAt,
      deletedByUserId: ownerUserId,
      deleteReason: 'duplicado',
    })
    await expect(
      deleteEntry(databases.app, { ...refOf(entryId), userId: ownerUserId }),
    ).rejects.toMatchObject({ code: 'ENTRY_ALREADY_DELETED' })
  })

  it('does not find an entry of another workspace', async () => {
    const entryId = await recordExpense()
    await expect(
      deleteEntry(databases.app, { workspaceId: workspaceB, entryId, userId: ownerUserId }),
    ).rejects.toMatchObject({ code: 'ENTRY_NOT_FOUND' })
    expect((await entryRow(entryId))?.deletedAt).toBeNull()
  })

  it('restores a deleted entry', async () => {
    const entryId = await recordExpense()
    await deleteEntry(databases.app, { ...refOf(entryId), userId: ownerUserId, reason: 'x' })
    await restoreEntry(databases.app, refOf(entryId))
    expect(await entryRow(entryId)).toMatchObject({
      deletedAt: null,
      deletedByUserId: null,
      deleteReason: null,
    })
    await expect(restoreEntry(databases.app, refOf(entryId))).rejects.toMatchObject({
      code: 'ENTRY_NOT_DELETED',
    })
  })

  it('replaces an entry: the old one is deleted and the new one points to it', async () => {
    const original = await recordExpense(1500)
    const { entryId: replacement } = await replaceEntry(
      databases.app,
      context,
      original,
      expenseOf(1800),
    )

    expect((await entryRow(original))?.deletedAt).not.toBeNull()
    expect(await entryRow(replacement)).toMatchObject({
      replacesEntryId: original,
      deletedAt: null,
    })
    expect(await postingsOf(replacement)).toEqual([
      [groceries, 1800],
      [checking, -1800],
    ])
  })

  it('refuses restoring an entry that was replaced', async () => {
    const original = await recordExpense()
    await replaceEntry(databases.app, context, original, expenseOf(2000))
    await expect(restoreEntry(databases.app, refOf(original))).rejects.toMatchObject({
      code: 'ENTRY_CANNOT_BE_RESTORED',
    })
  })

  it('keeps the original untouched when the replacement is invalid', async () => {
    const original = await recordExpense()
    await expect(
      replaceEntry(databases.app, context, original, expenseOf(0)),
    ).rejects.toMatchObject({ code: 'ENTRY_INVALID' })
    const brokenRule = { ...expenseOf(100), categoryId: checking }
    await expect(replaceEntry(databases.app, context, original, brokenRule)).rejects.toMatchObject({
      code: 'NOT_AN_EXPENSE_CATEGORY',
    })
    expect((await entryRow(original))?.deletedAt).toBeNull()
  })

  it('refuses replacing an entry that is already deleted', async () => {
    const original = await recordExpense()
    await replaceEntry(databases.app, context, original, expenseOf(1600))
    await expect(
      replaceEntry(databases.app, context, original, expenseOf(1700)),
    ).rejects.toMatchObject({ code: 'ENTRY_ALREADY_DELETED' })
  })
})

async function accountRow(accountId: string, workspaceId = workspaceA) {
  const [account] = await withWorkspace(databases.app, workspaceId, (tx) =>
    tx.select().from(ledgerAccounts).where(eq(ledgerAccounts.id, accountId)),
  )
  return account
}

describe('account services', () => {
  const context = () => ({ workspaceId: workspaceA, userId: ownerUserId })
  const refOf = (accountId: string) => ({ workspaceId: workspaceA, accountId })

  async function create(input: Record<string, unknown>): Promise<string> {
    return (await createAccount(databases.app, context(), input)).accountId
  }

  async function category(name = uniqueName('Categoria'), parentId?: string) {
    return create({ kind: 'expense_category', name, parentId })
  }

  it('creates an account in the workspace currency, trimming the name', async () => {
    const name = uniqueName('Conta')
    const accountId = await create({ kind: 'checking', name: `  ${name} `, color: '#112233' })
    expect(await accountRow(accountId)).toMatchObject({
      kind: 'checking',
      name,
      currency: 'BRL',
      color: '#112233',
      parentId: null,
    })
  })

  it('nests a category under a parent of the same class only', async () => {
    const parent = await category()
    const child = await category(uniqueName('Mercado'), parent)
    expect((await accountRow(child))?.parentId).toBe(parent)

    await expect(
      create({ kind: 'income_category', name: 'X', incomeNature: 'fixed', parentId: parent }),
    ).rejects.toMatchObject({ code: 'PARENT_OF_ANOTHER_CLASS' })

    const parentElsewhere = await insertAccount({ kind: 'expense_category' }, workspaceB)
    await expect(category('Y', parentElsewhere)).rejects.toMatchObject({
      code: 'PARENT_NOT_AVAILABLE',
    })
  })

  it('refuses a name already used by a sibling, and invalid input', async () => {
    const name = uniqueName('Lazer')
    await category(name)
    await expect(category(name.toUpperCase())).rejects.toMatchObject({
      code: 'ACCOUNT_NAME_TAKEN',
    })
    await expect(create({ kind: 'credit_card', name: 'Cartão' })).rejects.toMatchObject({
      code: 'ACCOUNT_INVALID',
    })
  })

  it('renames and moves an account, but never under its own descendant', async () => {
    const top = await category()
    const middle = await category(uniqueName('Meio'), top)
    const other = await category()
    const newName = uniqueName('Renomeada')

    await changeAccount(databases.app, refOf(middle), { name: newName, parentId: other })
    expect(await accountRow(middle)).toMatchObject({ name: newName, parentId: other })

    await expect(
      changeAccount(databases.app, refOf(other), { parentId: middle }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_CHANGE_REFUSED' })
  })

  it('lets system accounts be personalized but not renamed or archived', async () => {
    const receivable = await systemAccountOf(workspaceA, 'receivable')
    await changeAccount(databases.app, refOf(receivable), { color: '#abcdef' })
    expect((await accountRow(receivable))?.color).toBe('#abcdef')

    await expect(
      changeAccount(databases.app, refOf(receivable), { name: 'Outro nome' }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_CHANGE_REFUSED' })
    await expect(archiveAccount(databases.app, refOf(receivable))).rejects.toMatchObject({
      code: 'ACCOUNT_CHANGE_REFUSED',
    })
  })

  it('archives and unarchives an account', async () => {
    const accountId = await create({ kind: 'savings', name: uniqueName('Poupança') })
    await archiveAccount(databases.app, refOf(accountId), { now: () => new Date('2026-10-01') })
    expect((await accountRow(accountId))?.archivedAt).toEqual(new Date('2026-10-01'))
    await unarchiveAccount(databases.app, refOf(accountId))
    expect((await accountRow(accountId))?.archivedAt).toBeNull()
  })

  it('deletes an unused account, refuses one used by entries or a system one', async () => {
    const unused = await create({ kind: 'cash_wallet', name: uniqueName('Carteira') })
    await deleteAccount(databases.app, { ...refOf(unused), userId: ownerUserId, reason: 'fechada' })
    expect(await accountRow(unused)).toMatchObject({
      deletedByUserId: ownerUserId,
      deleteReason: 'fechada',
    })

    const used = await create({ kind: 'checking', name: uniqueName('Usada') })
    const food = await category()
    await recordRaw(spend(1000, used, food))
    await expect(
      deleteAccount(databases.app, { ...refOf(used), userId: ownerUserId }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_CANNOT_BE_DELETED' })

    const openingBalance = await systemAccountOf(workspaceA, 'opening_balance')
    await expect(
      deleteAccount(databases.app, { ...refOf(openingBalance), userId: ownerUserId }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_CANNOT_BE_DELETED' })
  })

  it('restores a deleted account unless its name was taken meanwhile', async () => {
    const name = uniqueName('Volta')
    const accountId = await category(name)
    await deleteAccount(databases.app, { ...refOf(accountId), userId: ownerUserId })
    await restoreAccount(databases.app, refOf(accountId))
    expect((await accountRow(accountId))?.deletedAt).toBeNull()
    await expect(restoreAccount(databases.app, refOf(accountId))).rejects.toMatchObject({
      code: 'ACCOUNT_NOT_DELETED',
    })

    await deleteAccount(databases.app, { ...refOf(accountId), userId: ownerUserId })
    await category(name)
    await expect(restoreAccount(databases.app, refOf(accountId))).rejects.toMatchObject({
      code: 'ACCOUNT_NAME_TAKEN',
    })
  })

  it('does not find an account of another workspace', async () => {
    const elsewhere = await insertAccount({ kind: 'checking' }, workspaceB)
    await expect(
      changeAccount(databases.app, refOf(elsewhere), { name: 'x' }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_NOT_FOUND' })
  })
})

async function insertCard(
  workspaceId = workspaceA,
  details: Partial<typeof cardDetails.$inferInsert> = {},
) {
  const accountId = await insertAccount({ kind: 'credit_card' }, workspaceId)
  await withWorkspace(databases.app, workspaceId, (tx) =>
    tx
      .insert(cardDetails)
      .values({ workspaceId, accountId, closingDay: 3, dueDay: 10, ...details }),
  )
  return accountId
}

async function insertInvoice(
  cardAccountId: string,
  invoice: NewInvoice = {},
  workspaceId = workspaceA,
): Promise<string> {
  const [inserted] = await withWorkspace(databases.app, workspaceId, (tx) =>
    tx
      .insert(cardInvoices)
      .values({
        workspaceId,
        cardAccountId,
        referenceMonth: '2026-10-01',
        closingOn: '2026-10-03',
        dueOn: '2026-10-10',
        status: 'open',
        ...invoice,
      })
      .returning({ id: cardInvoices.id }),
  )
  if (!inserted) {
    throw new Error('Could not insert the invoice')
  }
  return inserted.id
}

function purchase(amountCents: number, card: string, invoiceId: string, on: string): PostingLine[] {
  return [
    { accountId: on, kind: 'expense_category', amountCents },
    { accountId: card, kind: 'credit_card', amountCents: -amountCents, invoiceId },
  ]
}

describe('cards and invoices', () => {
  let groceries: string
  let checking: string

  beforeAll(async () => {
    groceries = await insertAccount({ kind: 'expense_category' })
    checking = await insertAccount({ kind: 'checking' })
  })

  it('attach card details only to credit card accounts', async () => {
    const notACard = await insertAccount({ kind: 'checking' })
    const details = withWorkspace(databases.app, workspaceA, (tx) =>
      tx
        .insert(cardDetails)
        .values({ workspaceId: workspaceA, accountId: notACard, closingDay: 3, dueDay: 10 }),
    )
    expect(await postgresErrorCodeOf(details)).toBe(POSTGRES_ERRORS.foreignKeyViolation)
  })

  it('keep closing and due days within a month', async () => {
    expect(await postgresErrorCodeOf(insertCard(workspaceA, { closingDay: 32 }))).toBe(
      POSTGRES_ERRORS.checkViolation,
    )
    expect(await postgresErrorCodeOf(insertCard(workspaceA, { dueDay: 0 }))).toBe(
      POSTGRES_ERRORS.checkViolation,
    )
  })

  it('have one invoice per card and month, due after closing, on the first of the month', async () => {
    const card = await insertCard()
    await insertInvoice(card)
    expect(await postgresErrorCodeOf(insertInvoice(card))).toBe(POSTGRES_ERRORS.uniqueViolation)
    expect(await postgresErrorCodeOf(insertInvoice(card, { referenceMonth: '2026-11-15' }))).toBe(
      POSTGRES_ERRORS.checkViolation,
    )
    expect(
      await postgresErrorCodeOf(
        insertInvoice(card, { referenceMonth: '2026-12-01', dueOn: '2026-10-02' }),
      ),
    ).toBe(POSTGRES_ERRORS.checkViolation)
  })

  it('are isolated per workspace', async () => {
    const cardInB = await insertCard(workspaceB)
    await insertInvoice(cardInB, {}, workspaceB)
    const seenFromA = await withWorkspace(databases.app, workspaceA, async (tx) => ({
      details: await tx.select().from(cardDetails).where(eq(cardDetails.accountId, cardInB)),
      invoices: await tx.select().from(cardInvoices).where(eq(cardInvoices.cardAccountId, cardInB)),
    }))
    expect(seenFromA).toEqual({ details: [], invoices: [] })
  })

  it('record a card purchase on an invoice of that card', async () => {
    const card = await insertCard()
    const invoice = await insertInvoice(card)
    expect(
      await recordOutcome(purchase(4000, card, invoice, groceries), { entryType: 'card_purchase' }),
    ).toBeUndefined()
  })

  it('refuse a card posting without an invoice or on the invoice of another card', async () => {
    const card = await insertCard()
    const otherCard = await insertCard()
    const otherInvoice = await insertInvoice(otherCard)
    const withoutInvoice: PostingLine[] = [
      { accountId: groceries, kind: 'expense_category', amountCents: 1000 },
      { accountId: card, kind: 'credit_card', amountCents: -1000 },
    ]
    expect(await recordOutcome(withoutInvoice)).toBe(POSTGRES_ERRORS.checkViolation)
    expect(await recordOutcome(purchase(1000, card, otherInvoice, groceries))).toBe(
      POSTGRES_ERRORS.foreignKeyViolation,
    )
  })

  it('refuse an invoice on a posting that is not on a card', async () => {
    const card = await insertCard()
    const invoice = await insertInvoice(card)
    const invoiceOnChecking: PostingLine[] = [
      { accountId: groceries, kind: 'expense_category', amountCents: 1000 },
      { accountId: checking, kind: 'checking', amountCents: -1000, invoiceId: invoice },
    ]
    expect(await recordOutcome(invoiceOnChecking)).toBe(POSTGRES_ERRORS.checkViolation)
  })

  it('refuse purchases on a closed invoice but accept payments, refunds and adjustments', async () => {
    const card = await insertCard()
    const closed = await insertInvoice(card, { status: 'closed' })
    expect(
      await recordOutcome(purchase(1000, card, closed, groceries), { entryType: 'card_purchase' }),
    ).toBe(POSTGRES_ERRORS.checkViolation)

    const payment: PostingLine[] = [
      { accountId: card, kind: 'credit_card', amountCents: 1000, invoiceId: closed },
      { accountId: checking, kind: 'checking', amountCents: -1000 },
    ]
    for (const entryType of ['invoice_payment', 'refund', 'adjustment'] as const) {
      expect(await recordOutcome(payment, { entryType })).toBeUndefined()
    }
  })

  it('keep an entry on a closed invoice from being deleted or restored', async () => {
    const card = await insertCard()
    const invoice = await insertInvoice(card)
    const entryId = await recordRaw(purchase(1000, card, invoice, groceries), {
      entryType: 'card_purchase',
    })
    const deletedEntryId = await recordRaw(purchase(500, card, invoice, groceries), {
      entryType: 'card_purchase',
    })
    await updateEntryRaw(deletedEntryId, { deletedAt: new Date() })
    await withWorkspace(databases.app, workspaceA, (tx) =>
      tx.update(cardInvoices).set({ status: 'closed' }).where(eq(cardInvoices.id, invoice)),
    )

    expect(await postgresErrorCodeOf(updateEntryRaw(entryId, { deletedAt: new Date() }))).toBe(
      POSTGRES_ERRORS.checkViolation,
    )
    expect(await postgresErrorCodeOf(updateEntryRaw(deletedEntryId, { deletedAt: null }))).toBe(
      POSTGRES_ERRORS.checkViolation,
    )
  })

  it('go away with the workspace when it is erased', async () => {
    const workspaceId = (await fixtures.createWorkspaceOwnedBy(ownerUserId, 'Erase cards'))
      .workspaceId
    const payFrom = await insertAccount({ kind: 'checking' }, workspaceId)
    const card = await insertCard(workspaceId, { paymentAccountId: payFrom })
    const invoice = await insertInvoice(card, {}, workspaceId)
    const food = await insertAccount({ kind: 'expense_category' }, workspaceId)
    const original = await recordRaw(
      purchase(1000, card, invoice, food),
      { entryType: 'card_purchase' },
      workspaceId,
    )
    await updateEntryRaw(original, { deletedAt: new Date() }, workspaceId)
    await recordRaw(
      purchase(1200, card, invoice, food),
      { entryType: 'card_purchase', replacesEntryId: original },
      workspaceId,
    )

    const erase = databases.owner.delete(workspaces).where(eq(workspaces.id, workspaceId))
    expect(await postgresErrorCodeOf(erase)).toBeUndefined()
  })
})

function updateEntryRaw(entryId: string, changes: NewEntry, workspaceId = workspaceA) {
  return withWorkspace(databases.app, workspaceId, (tx) =>
    tx.update(journalEntries).set(changes).where(eq(journalEntries.id, entryId)),
  )
}

describe('card services', () => {
  const context = () => ({ workspaceId: workspaceA, userId: ownerUserId })

  async function cardRow(cardAccountId: string) {
    const [row] = await withWorkspace(databases.app, workspaceA, (tx) =>
      tx.select().from(cardDetails).where(eq(cardDetails.accountId, cardAccountId)),
    )
    return row
  }

  it('creates a card account with its details', async () => {
    const payFrom = await insertAccount({ kind: 'checking' })
    const name = uniqueName('Cartão')
    const { accountId } = await createCard(databases.app, context(), {
      name,
      closingDay: 28,
      dueDay: 5,
      limitCents: 500000,
      paymentAccountId: payFrom,
    })
    expect(await accountRow(accountId)).toMatchObject({
      kind: 'credit_card',
      name,
      currency: 'BRL',
    })
    expect(await cardRow(accountId)).toMatchObject({
      closingDay: 28,
      dueDay: 5,
      purchaseOnClosingDayGoesNext: true,
      limitCents: 500000,
      paymentAccountId: payFrom,
    })
  })

  it('pays invoices only from an active money account', async () => {
    const category = await insertAccount({ kind: 'expense_category' })
    const archived = await insertAccount({ kind: 'checking', archivedAt: new Date() })
    for (const paymentAccountId of [category, archived]) {
      await expect(
        createCard(databases.app, context(), {
          name: uniqueName('Cartão'),
          closingDay: 3,
          dueDay: 10,
          paymentAccountId,
        }),
      ).rejects.toMatchObject({ code: 'PAYMENT_ACCOUNT_NOT_AVAILABLE' })
    }
  })

  it('refuses an invalid cycle and a taken name', async () => {
    await expect(
      createCard(databases.app, context(), { name: 'X', closingDay: 0, dueDay: 10 }),
    ).rejects.toMatchObject({ code: 'CARD_INVALID' })
    const name = uniqueName('Cartão')
    await createCard(databases.app, context(), { name, closingDay: 3, dueDay: 10 })
    await expect(
      createCard(databases.app, context(), { name, closingDay: 3, dueDay: 10 }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_NAME_TAKEN' })
  })

  it('changes the cycle, limit and payment account of a card', async () => {
    const { accountId } = await createCard(databases.app, context(), {
      name: uniqueName('Cartão'),
      closingDay: 3,
      dueDay: 10,
      limitCents: 100000,
    })
    await changeCard(
      databases.app,
      { workspaceId: workspaceA, cardAccountId: accountId },
      { closingDay: 5, dueDay: 12, limitCents: null, purchaseOnClosingDayGoesNext: false },
    )
    expect(await cardRow(accountId)).toMatchObject({
      closingDay: 5,
      dueDay: 12,
      limitCents: null,
      purchaseOnClosingDayGoesNext: false,
    })
  })

  it('does not find a card that is not a card or is in another workspace', async () => {
    const checking = await insertAccount({ kind: 'checking' })
    const cardInB = await insertCard(workspaceB)
    for (const cardAccountId of [checking, cardInB]) {
      await expect(
        changeCard(databases.app, { workspaceId: workspaceA, cardAccountId }, { dueDay: 9 }),
      ).rejects.toMatchObject({ code: 'CARD_NOT_FOUND' })
    }
  })
})

describe('card purchases and invoice payments', () => {
  let context: EntryContext
  let checking: string
  let electronics: string
  let card: string

  const onDay = (isoInstant: string) => ({ now: () => new Date(isoInstant) })
  const midSeptember = onDay('2026-09-15T15:00:00Z')

  beforeAll(async () => {
    context = { workspaceId: workspaceA, userId: ownerUserId, source: 'web' }
    checking = await insertAccount({ kind: 'checking' })
    electronics = await insertAccount({ kind: 'expense_category' })
    card = (
      await createCard(
        databases.app,
        { workspaceId: workspaceA, userId: ownerUserId },
        { name: uniqueName('Cartão X'), closingDay: 3, dueDay: 10, paymentAccountId: checking },
      )
    ).accountId
  })

  function buy(amountCents: number, installmentCount: number, occurredOn = '2026-09-15') {
    return {
      entryType: 'card_purchase',
      occurredOn,
      description: 'TV',
      amountCents,
      installmentCount,
      cardAccountId: card,
      categoryId: electronics,
    }
  }

  async function invoicesOf(cardAccountId: string) {
    return withWorkspace(databases.app, workspaceA, (tx) =>
      tx
        .select({
          id: cardInvoices.id,
          referenceMonth: cardInvoices.referenceMonth,
          closingOn: cardInvoices.closingOn,
          dueOn: cardInvoices.dueOn,
          status: cardInvoices.status,
        })
        .from(cardInvoices)
        .where(eq(cardInvoices.cardAccountId, cardAccountId))
        .orderBy(asc(cardInvoices.referenceMonth)),
    )
  }

  async function cardLinesOf(entryId: string) {
    return withWorkspace(databases.app, workspaceA, (tx) =>
      tx
        .select({
          accountId: postings.accountId,
          amountCents: postings.amountCents,
          invoiceId: postings.invoiceId,
          installmentNo: postings.installmentNo,
          effectiveOn: postings.effectiveOn,
        })
        .from(postings)
        .where(eq(postings.entryId, entryId))
        .orderBy(asc(postings.lineNo)),
    )
  }

  it('splits R$ 1.000,00 in 3x over the October, November and December invoices', async () => {
    const { entryId } = await recordEntry(databases.app, context, buy(100000, 3), midSeptember)
    const invoices = await invoicesOf(card)
    expect(
      invoices.map(({ referenceMonth, closingOn, dueOn, status }) => [
        referenceMonth,
        closingOn,
        dueOn,
        status,
      ]),
    ).toEqual([
      ['2026-10-01', '2026-10-03', '2026-10-10', 'open'],
      ['2026-11-01', '2026-11-03', '2026-11-10', 'future'],
      ['2026-12-01', '2026-12-03', '2026-12-10', 'future'],
    ])
    const [october, november, december] = invoices.map((invoice) => invoice.id)
    expect(await cardLinesOf(entryId)).toEqual([
      {
        accountId: card,
        amountCents: -33334,
        invoiceId: october,
        installmentNo: 1,
        effectiveOn: '2026-10-10',
      },
      {
        accountId: card,
        amountCents: -33333,
        invoiceId: november,
        installmentNo: 2,
        effectiveOn: '2026-11-10',
      },
      {
        accountId: card,
        amountCents: -33333,
        invoiceId: december,
        installmentNo: 3,
        effectiveOn: '2026-12-10',
      },
      {
        accountId: electronics,
        amountCents: 33334,
        invoiceId: null,
        installmentNo: 1,
        effectiveOn: '2026-10-10',
      },
      {
        accountId: electronics,
        amountCents: 33333,
        invoiceId: null,
        installmentNo: 2,
        effectiveOn: '2026-11-10',
      },
      {
        accountId: electronics,
        amountCents: 33333,
        invoiceId: null,
        installmentNo: 3,
        effectiveOn: '2026-12-10',
      },
    ])
    expect(await entryRow(entryId)).toMatchObject({ installmentCount: 3, paymentMethod: 'credit' })
  })

  it('reuses the invoices that already exist', async () => {
    await recordEntry(databases.app, context, buy(5000, 2), midSeptember)
    const months = (await invoicesOf(card)).map((invoice) => invoice.referenceMonth)
    expect(months).toEqual([...new Set(months)])
  })

  it('refuses a purchase that would land on a closed invoice', async () => {
    await expect(
      recordEntry(databases.app, context, buy(5000, 1, '2026-09-02'), midSeptember),
    ).rejects.toMatchObject({ code: 'INVOICE_CLOSED' })
  })

  it('moves the statuses forward with time, in the workspace time zone', async () => {
    const lateOnOctoberSecondInSaoPaulo = onDay('2026-10-03T02:00:00Z')
    await recordEntry(
      databases.app,
      context,
      buy(1000, 1, '2026-10-02'),
      lateOnOctoberSecondInSaoPaulo,
    )
    expect((await invoicesOf(card)).find((i) => i.referenceMonth === '2026-10-01')?.status).toBe(
      'open',
    )

    await recordEntry(
      databases.app,
      context,
      buy(1000, 1, '2026-10-05'),
      onDay('2026-10-05T15:00:00Z'),
    )
    const statuses = Object.fromEntries(
      (await invoicesOf(card)).map((invoice) => [invoice.referenceMonth, invoice.status]),
    )
    expect(statuses).toMatchObject({
      '2026-10-01': 'closed',
      '2026-11-01': 'open',
      '2026-12-01': 'future',
    })
  })

  it('pays a closed invoice from the card payment account', async () => {
    const october = (await invoicesOf(card)).find((i) => i.referenceMonth === '2026-10-01')
    const { entryId } = await recordEntry(
      databases.app,
      context,
      {
        entryType: 'invoice_payment',
        occurredOn: '2026-10-10',
        description: 'Fatura outubro',
        amountCents: 40000,
        cardAccountId: card,
        invoiceId: october?.id,
      },
      onDay('2026-10-10T15:00:00Z'),
    )
    expect(await postingsOf(entryId)).toEqual([
      [card, 40000],
      [checking, -40000],
    ])
  })

  it('refuses a payment without an account to pay from', async () => {
    const cardWithoutPaymentAccount = (
      await createCard(
        databases.app,
        { workspaceId: workspaceA, userId: ownerUserId },
        { name: uniqueName('Cartão Y'), closingDay: 28, dueDay: 5 },
      )
    ).accountId
    const { entryId } = await recordEntry(
      databases.app,
      context,
      { ...buy(1000, 1), cardAccountId: cardWithoutPaymentAccount },
      midSeptember,
    )
    const [invoice] = await invoicesOf(cardWithoutPaymentAccount)
    expect(entryId).toBeDefined()
    await expect(
      recordEntry(
        databases.app,
        context,
        {
          entryType: 'invoice_payment',
          occurredOn: '2026-10-05',
          description: 'Fatura',
          amountCents: 1000,
          cardAccountId: cardWithoutPaymentAccount,
          invoiceId: invoice?.id,
        },
        midSeptember,
      ),
    ).rejects.toMatchObject({ code: 'PAYMENT_ACCOUNT_REQUIRED' })
  })

  it('refuses paying the invoice of another card and buying on something that is not a card', async () => {
    const otherCard = await insertCard()
    const otherInvoice = await insertInvoice(otherCard)
    await expect(
      recordEntry(
        databases.app,
        context,
        {
          entryType: 'invoice_payment',
          occurredOn: '2026-10-10',
          description: 'Fatura',
          amountCents: 1000,
          cardAccountId: card,
          invoiceId: otherInvoice,
        },
        midSeptember,
      ),
    ).rejects.toMatchObject({ code: 'INVOICE_NOT_FOUND' })

    await expect(
      recordEntry(
        databases.app,
        context,
        { ...buy(1000, 1), cardAccountId: checking },
        midSeptember,
      ),
    ).rejects.toMatchObject({ code: 'NOT_A_CARD' })
  })
})

describe('purchases already in progress', () => {
  const midSeptember = { now: () => new Date('2026-09-15T15:00:00Z') }
  let context: EntryContext
  let card: string
  let electronics: string

  beforeAll(async () => {
    context = { workspaceId: workspaceA, userId: ownerUserId, source: 'web' }
    electronics = await insertAccount({ kind: 'expense_category' })
    card = (
      await createCard(
        databases.app,
        { workspaceId: workspaceA, userId: ownerUserId },
        { name: uniqueName('Cartão Z'), closingDay: 3, dueDay: 10 },
      )
    ).accountId
  })

  function tvIn10x(firstInstallment: number) {
    return {
      entryType: 'card_purchase',
      occurredOn: '2026-04-15',
      description: 'TV',
      amountCents: 120000,
      installmentCount: 10,
      firstInstallment,
      cardAccountId: card,
      categoryId: electronics,
    }
  }

  it('records only the remaining installments, on the invoices they were always going to', async () => {
    const { entryId } = await recordEntry(databases.app, context, tvIn10x(6), midSeptember)

    const lines = await withWorkspace(databases.app, workspaceA, (tx) =>
      tx
        .select({
          amountCents: postings.amountCents,
          installmentNo: postings.installmentNo,
          effectiveOn: postings.effectiveOn,
        })
        .from(postings)
        .where(and(eq(postings.entryId, entryId), eq(postings.accountId, card)))
        .orderBy(asc(postings.lineNo)),
    )
    expect(lines).toEqual([
      { amountCents: -12000, installmentNo: 6, effectiveOn: '2026-10-10' },
      { amountCents: -12000, installmentNo: 7, effectiveOn: '2026-11-10' },
      { amountCents: -12000, installmentNo: 8, effectiveOn: '2026-12-10' },
      { amountCents: -12000, installmentNo: 9, effectiveOn: '2027-01-10' },
      { amountCents: -12000, installmentNo: 10, effectiveOn: '2027-02-10' },
    ])
    expect(await entryRow(entryId)).toMatchObject({ installmentCount: 10 })
  })

  it('points to the first open installment when the chosen one is on a closed invoice', async () => {
    const recorded = recordEntry(databases.app, context, tvIn10x(5), midSeptember)
    await expect(recorded).rejects.toMatchObject({ code: 'INVOICE_CLOSED' })
    await expect(recorded).rejects.toThrow(/installment 6/)
  })

  it('refuses a first installment after the last one', async () => {
    await expect(
      recordEntry(databases.app, context, { ...tvIn10x(11) }, midSeptember),
    ).rejects.toMatchObject({ code: 'FIRST_INSTALLMENT_OUT_OF_RANGE' })
  })
})

describe('balances and invoice totals', () => {
  let workspaceId: string
  let context: EntryContext
  const accounts = { checking: '', savings: '', groceries: '', salary: '', card: '' }
  const midSeptember = { now: () => new Date('2026-09-15T15:00:00Z') }
  const octoberTenth = { now: () => new Date('2026-10-10T15:00:00Z') }

  beforeAll(async () => {
    workspaceId = (await fixtures.createWorkspaceOwnedBy(ownerUserId, 'Balances')).workspaceId
    context = { workspaceId, userId: ownerUserId, source: 'web' }
    const ledgerContext = { workspaceId, userId: ownerUserId }
    const create = async (input: Record<string, unknown>) =>
      (await createAccount(databases.app, ledgerContext, input)).accountId
    accounts.checking = await create({ kind: 'checking', name: 'Conta' })
    accounts.savings = await create({ kind: 'savings', name: 'Reserva' })
    accounts.groceries = await create({ kind: 'expense_category', name: 'Mercado' })
    accounts.salary = await create({
      kind: 'income_category',
      name: 'Salário',
      incomeNature: 'fixed',
    })
    accounts.card = (
      await createCard(databases.app, ledgerContext, {
        name: 'Cartão X',
        closingDay: 3,
        dueDay: 10,
        paymentAccountId: accounts.checking,
      })
    ).accountId

    const day = { occurredOn: '2026-09-15', description: 'x' }
    const record = (input: Record<string, unknown>, clock = midSeptember) =>
      recordEntry(databases.app, context, { ...day, ...input }, clock)

    await record({
      entryType: 'opening_balance',
      balanceCents: 200000,
      accountId: accounts.checking,
    })
    await record({
      entryType: 'income',
      amountCents: 500000,
      receivedInAccountId: accounts.checking,
      categoryId: accounts.salary,
    })
    await record({
      entryType: 'expense',
      amountCents: 8750,
      paidFromAccountId: accounts.checking,
      categoryId: accounts.groceries,
    })
    await record({
      entryType: 'transfer',
      amountCents: 100000,
      fromAccountId: accounts.checking,
      toAccountId: accounts.savings,
    })
    const mistake = await record({
      entryType: 'expense',
      amountCents: 1000,
      paidFromAccountId: accounts.checking,
      categoryId: accounts.groceries,
    })
    await deleteEntry(databases.app, { workspaceId, entryId: mistake.entryId, userId: ownerUserId })
    await record({
      entryType: 'card_purchase',
      amountCents: 100000,
      installmentCount: 3,
      cardAccountId: accounts.card,
      categoryId: accounts.groceries,
    })

    const [october] = await listInvoiceTotals(databases.app, {
      workspaceId,
      cardAccountId: accounts.card,
    })
    await record(
      {
        entryType: 'invoice_payment',
        occurredOn: '2026-10-10',
        amountCents: 20000,
        cardAccountId: accounts.card,
        invoiceId: october?.invoiceId,
      },
      octoberTenth,
    )
  })

  it('gives every account its balance in natural terms, leaving deleted entries out', async () => {
    const balances = await listAccountBalances(databases.app, workspaceId)
    const natural = (accountId: string | undefined) =>
      balances.find((balance) => balance.accountId === accountId)?.naturalBalanceCents
    const byKind = (kind: string) =>
      balances.find((balance) => balance.kind === kind)?.naturalBalanceCents

    expect(natural(accounts.checking)).toBe(200000 + 500000 - 8750 - 100000 - 20000)
    expect(natural(accounts.savings)).toBe(100000)
    expect(natural(accounts.groceries)).toBe(8750 + 100000)
    expect(natural(accounts.salary)).toBe(500000)
    expect(natural(accounts.card)).toBe(100000 - 20000)
    expect(byKind('opening_balance')).toBe(200000)
    expect(byKind('receivable')).toBe(0)
  })

  it('always sums to zero across all accounts (double entry)', async () => {
    const balances = await listAccountBalances(databases.app, workspaceId)
    expect(balances.reduce((sum, balance) => sum + balance.balanceCents, 0)).toBe(0)
  })

  it('totals each invoice: spent, paid and still due', async () => {
    const totals = await listInvoiceTotals(databases.app, {
      workspaceId,
      cardAccountId: accounts.card,
    })
    expect(
      totals.map(({ referenceMonth, status, totalCents, paidCents, dueCents }) => [
        referenceMonth,
        status,
        totalCents,
        paidCents,
        dueCents,
      ]),
    ).toEqual([
      ['2026-10-01', 'closed', 33334, 20000, 13334],
      ['2026-11-01', 'open', 33333, 0, 33333],
      ['2026-12-01', 'future', 33333, 0, 33333],
    ])
  })

  it('shows only the balances of the current workspace', async () => {
    const seenFromA = await listAccountBalances(databases.app, workspaceA)
    expect(seenFromA.some((balance) => balance.accountId === accounts.checking)).toBe(false)
    const withoutWorkspace = await databases.app.select().from(accountBalances)
    expect(withoutWorkspace).toEqual([])
  })
})
