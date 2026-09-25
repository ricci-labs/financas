import { withWorkspace } from '@api/core/db/tx'
import { ledgerAccounts } from '@api/modules/ledger/ledger.table'
import { connectTestDatabases, POSTGRES_ERRORS, postgresErrorCodeOf } from '@api/testing/database'
import { createFixtures } from '@api/testing/fixtures'
import { ACCOUNT_CLASS_BY_KIND, ACCOUNT_KINDS, type AccountKind } from '@financas/shared'
import { eq } from 'drizzle-orm'
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
