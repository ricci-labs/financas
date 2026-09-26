import { withWorkspace } from '@api/core/db/tx'
import { ledgerAccounts } from '@api/modules/ledger/ledger.table'
import { holidayDatesOf } from '@api/modules/planning'
import {
  budgetLines,
  goals,
  recurrenceRules,
  workspaceHolidays,
} from '@api/modules/planning/planning.table'
import { workspaces } from '@api/modules/workspaces/workspaces.table'
import { connectTestDatabases, POSTGRES_ERRORS, postgresErrorCodeOf } from '@api/testing/database'
import { createFixtures } from '@api/testing/fixtures'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const databases = connectTestDatabases()
const fixtures = createFixtures(databases.owner, databases.app)

let ownerUserId: string

beforeAll(async () => {
  ownerUserId = await fixtures.createUser('holidays-owner')
})

afterAll(async () => {
  await fixtures.removeEverything()
  await databases.closeAll()
})

async function newWorkspace(name: string): Promise<string> {
  return (await fixtures.createWorkspaceOwnedBy(ownerUserId, name)).workspaceId
}

function insertHoliday(workspaceId: string, onDate: string, name = 'Aniversário da cidade') {
  return withWorkspace(databases.app, workspaceId, (tx) =>
    tx.insert(workspaceHolidays).values({ workspaceId, onDate, name }).returning(),
  )
}

describe('workspace_holidays', () => {
  it('keep one active holiday per day, and free the day once it is deleted', async () => {
    const workspaceId = await newWorkspace('One per day')
    const [first] = await insertHoliday(workspaceId, '2026-01-25')
    expect(await postgresErrorCodeOf(insertHoliday(workspaceId, '2026-01-25'))).toBe(
      POSTGRES_ERRORS.uniqueViolation,
    )

    await databases.owner
      .update(workspaceHolidays)
      .set({ deletedAt: new Date() })
      .where(eq(workspaceHolidays.id, first?.id ?? ''))
    expect(await postgresErrorCodeOf(insertHoliday(workspaceId, '2026-01-25'))).toBeUndefined()
  })

  it('refuse a blank name', async () => {
    const workspaceId = await newWorkspace('Blank name')
    expect(await postgresErrorCodeOf(insertHoliday(workspaceId, '2026-03-19', '   '))).toBe(
      POSTGRES_ERRORS.checkViolation,
    )
  })

  it('stay inside their workspace', async () => {
    const mine = await newWorkspace('Mine')
    const theirs = await newWorkspace('Theirs')
    await insertHoliday(mine, '2026-07-09')

    const seenFromTheirs = await withWorkspace(databases.app, theirs, (tx) =>
      tx.select().from(workspaceHolidays),
    )
    expect(seenFromTheirs).toEqual([])
    const intoMine = withWorkspace(databases.app, theirs, (tx) =>
      tx.insert(workspaceHolidays).values({ workspaceId: mine, onDate: '2026-07-10', name: 'X' }),
    )
    expect(await postgresErrorCodeOf(intoMine)).toBe(POSTGRES_ERRORS.rowLevelSecurityViolation)
  })

  it('go away with the workspace when it is erased', async () => {
    const workspaceId = await newWorkspace('Erase holidays')
    await insertHoliday(workspaceId, '2026-08-15')
    const erase = databases.owner.delete(workspaces).where(eq(workspaces.id, workspaceId))
    expect(await postgresErrorCodeOf(erase)).toBeUndefined()
  })
})

describe('holidayDatesOf', () => {
  it('joins national and active workspace holidays inside the range', async () => {
    const workspaceId = await newWorkspace('Dates of')
    await insertHoliday(workspaceId, '2026-11-24')
    const [deleted] = await insertHoliday(workspaceId, '2026-11-25')
    await databases.owner
      .update(workspaceHolidays)
      .set({ deletedAt: new Date() })
      .where(eq(workspaceHolidays.id, deleted?.id ?? ''))
    await insertHoliday(workspaceId, '2026-12-08')

    const dates = await withWorkspace(databases.app, workspaceId, (tx) =>
      holidayDatesOf(tx, '2026-11-01', '2026-11-30'),
    )
    expect([...dates].sort()).toEqual(['2026-11-02', '2026-11-15', '2026-11-20', '2026-11-24'])
  })
})

async function accountIn(workspaceId: string, kind: 'checking' | 'expense_category', name: string) {
  const [account] = await withWorkspace(databases.app, workspaceId, (tx) =>
    tx
      .insert(ledgerAccounts)
      .values({ workspaceId, kind, name, currency: 'BRL' })
      .returning({ id: ledgerAccounts.id }),
  )
  return account?.id ?? ''
}

async function insertRule(
  workspaceId: string,
  overrides: Partial<typeof recurrenceRules.$inferInsert> = {},
) {
  const checking = await accountIn(workspaceId, 'checking', `Conta ${crypto.randomUUID()}`)
  const category = await accountIn(workspaceId, 'expense_category', `Casa ${crypto.randomUUID()}`)
  return withWorkspace(databases.app, workspaceId, (tx) =>
    tx.insert(recurrenceRules).values({
      workspaceId,
      description: 'Aluguel',
      entryType: 'expense',
      amountCents: 100_000,
      frequency: 'monthly',
      startsOn: '2026-10-01',
      sourceAccountId: checking,
      categoryAccountId: category,
      ...overrides,
    }),
  )
}

describe('recurrence_rules', () => {
  it('refuse schedules the service would never build', async () => {
    const workspaceId = await newWorkspace('Rule checks')
    for (const broken of [
      { frequency: 'weekly' as const, dayOfMonth: 5 },
      { dayOfMonth: 5, nthBusinessDay: 5 },
      { endsOn: '2026-09-30' },
      { amountCents: 0 },
      { dayOfMonth: null, nthBusinessDay: 11 },
    ]) {
      expect(await postgresErrorCodeOf(insertRule(workspaceId, broken))).toBe(
        POSTGRES_ERRORS.checkViolation,
      )
    }
  })

  it('go away with the workspace when it is erased', async () => {
    const workspaceId = await newWorkspace('Erase rules')
    await insertRule(workspaceId)
    const erase = databases.owner.delete(workspaces).where(eq(workspaces.id, workspaceId))
    expect(await postgresErrorCodeOf(erase)).toBeUndefined()
  })
})

describe('budget_lines', () => {
  async function insertLine(
    workspaceId: string,
    validFrom: string,
    limitCents: number | null = 100,
  ) {
    const category = await accountIn(
      workspaceId,
      'expense_category',
      `Budget ${crypto.randomUUID()}`,
    )
    return withWorkspace(databases.app, workspaceId, (tx) =>
      tx
        .insert(budgetLines)
        .values({ workspaceId, categoryAccountId: category, validFrom, limitCents }),
    )
  }

  it('start on the first day of a month and hold a positive limit or none', async () => {
    const workspaceId = await newWorkspace('Budget checks')
    expect(await postgresErrorCodeOf(insertLine(workspaceId, '2026-10-02'))).toBe(
      POSTGRES_ERRORS.checkViolation,
    )
    expect(await postgresErrorCodeOf(insertLine(workspaceId, '2026-10-01', 0))).toBe(
      POSTGRES_ERRORS.checkViolation,
    )
    expect(await postgresErrorCodeOf(insertLine(workspaceId, '2026-10-01', null))).toBeUndefined()
  })

  it('go away with the workspace when it is erased', async () => {
    const workspaceId = await newWorkspace('Erase budgets')
    await insertLine(workspaceId, '2026-10-01')
    const erase = databases.owner.delete(workspaces).where(eq(workspaces.id, workspaceId))
    expect(await postgresErrorCodeOf(erase)).toBeUndefined()
  })
})

describe('goals', () => {
  it('go away with the workspace when it is erased', async () => {
    const workspaceId = await newWorkspace('Erase goals')
    const savings = await accountIn(workspaceId, 'checking', 'Reserva')
    await withWorkspace(databases.app, workspaceId, (tx) =>
      tx.insert(goals).values({ workspaceId, name: 'Reserva', targetCents: 1, accountId: savings }),
    )
    const erase = databases.owner.delete(workspaces).where(eq(workspaces.id, workspaceId))
    expect(await postgresErrorCodeOf(erase)).toBeUndefined()
  })
})
