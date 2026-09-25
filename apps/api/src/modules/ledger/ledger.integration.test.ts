import { withWorkspace } from '@api/core/db/tx'
import { journalEntries, ledgerAccounts, postings } from '@api/modules/ledger/ledger.table'
import { workspaces } from '@api/modules/workspaces/workspaces.table'
import { connectTestDatabases, POSTGRES_ERRORS, postgresErrorCodeOf } from '@api/testing/database'
import { createFixtures } from '@api/testing/fixtures'
import {
  ACCOUNT_CLASS_BY_KIND,
  ACCOUNT_KINDS,
  type AccountKind,
  type SystemAccountKind,
} from '@financas/shared'
import { eq, inArray } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const databases = connectTestDatabases()
const fixtures = createFixtures(databases.owner, databases.app)

type NewAccount = Partial<typeof ledgerAccounts.$inferInsert> & { kind: AccountKind }

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

type NewEntry = Partial<typeof journalEntries.$inferInsert>

type PostingLine = {
  accountId: string
  kind: AccountKind
  amountCents: number
  lineNo?: number
}

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

  it('refuse postings on cards, receivables and payables until their columns exist', async () => {
    const card = await insertAccount({ kind: 'credit_card' })
    const onCard: PostingLine[] = [
      { accountId: groceries, kind: 'expense_category', amountCents: 1000 },
      { accountId: card, kind: 'credit_card', amountCents: -1000 },
    ]
    expect(await recordOutcome(onCard)).toBe(POSTGRES_ERRORS.checkViolation)

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
