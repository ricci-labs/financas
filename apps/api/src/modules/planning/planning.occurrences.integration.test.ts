import { withWorkspace } from '@api/core/db/tx'
import { ledgerAccounts } from '@api/modules/ledger/ledger.table'
import {
  changeRecurrenceRule,
  createRecurrenceRule,
  deleteRecurrenceRule,
  listOccurrences,
} from '@api/modules/planning'
import { plannedOccurrences } from '@api/modules/planning/planning.table'
import { connectTestDatabases } from '@api/testing/database'
import { createFixtures } from '@api/testing/fixtures'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const databases = connectTestDatabases()
const fixtures = createFixtures(databases.owner, databases.app)
const FIRST_OF_OCTOBER = { now: () => new Date('2026-10-01T12:00:00Z') }
const MID_DECEMBER = { now: () => new Date('2026-12-15T12:00:00Z') }
const WHOLE_PLAN = { from: '2026-10-01', to: '2027-06-30' }

let userId: string

beforeAll(async () => {
  userId = await fixtures.createUser('occurrences')
})

afterAll(async () => {
  await fixtures.removeEverything()
  await databases.closeAll()
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

async function workspaceWithRent(name: string) {
  const { workspaceId } = await fixtures.createWorkspaceOwnedBy(userId, name)
  const checking = await accountIn(workspaceId, 'checking', 'Conta X')
  const housing = await accountIn(workspaceId, 'expense_category', 'Moradia')
  const { ruleId } = await createRecurrenceRule(
    databases.app,
    { workspaceId, userId },
    {
      description: 'Aluguel',
      entryType: 'expense',
      amountCents: 200_000,
      sourceAccountId: checking,
      categoryAccountId: housing,
      schedule: {
        frequency: 'monthly',
        dayOfMonth: 10,
        weekendRule: 'next_business_day',
        startsOn: '2026-10-10',
      },
    },
    FIRST_OF_OCTOBER,
  )
  return { workspaceId, ruleId }
}

async function skip(ruleId: string, dueOn: string) {
  await databases.owner
    .update(plannedOccurrences)
    .set({ status: 'skipped' })
    .where(and(eq(plannedOccurrences.ruleId, ruleId), eq(plannedOccurrences.dueOn, dueOn)))
}

async function dueDates(workspaceId: string, clock = FIRST_OF_OCTOBER) {
  const occurrences = await listOccurrences(databases.app, workspaceId, WHOLE_PLAN, clock)
  return occurrences.map((occurrence) => `${occurrence.dueOn} ${occurrence.status}`)
}

describe('planned occurrences', () => {
  it('are planned up to six months ahead when a rule is created, on business days', async () => {
    const { workspaceId } = await workspaceWithRent('Planned')
    const occurrences = await listOccurrences(
      databases.app,
      workspaceId,
      WHOLE_PLAN,
      FIRST_OF_OCTOBER,
    )
    expect(occurrences.map((occurrence) => occurrence.dueOn)).toEqual([
      '2026-10-13',
      '2026-11-10',
      '2026-12-10',
      '2027-01-11',
      '2027-02-10',
      '2027-03-10',
      '2027-04-12',
    ])
    expect(occurrences[0]).toMatchObject({
      description: 'Aluguel',
      entryType: 'expense',
      amountCents: 200_000,
      status: 'pending',
      isOverdue: false,
    })
  })

  it('follow the horizon as days go by, and show the unpaid past ones as overdue', async () => {
    const { workspaceId, ruleId } = await workspaceWithRent('Horizon')
    await skip(ruleId, '2026-11-10')
    const occurrences = await listOccurrences(databases.app, workspaceId, WHOLE_PLAN, MID_DECEMBER)
    expect(occurrences.map((occurrence) => [occurrence.dueOn, occurrence.isOverdue])).toEqual([
      ['2026-10-13', true],
      ['2026-11-10', false],
      ['2026-12-10', true],
      ['2027-01-11', false],
      ['2027-02-10', false],
      ['2027-03-10', false],
      ['2027-04-12', false],
      ['2027-05-10', false],
      ['2027-06-10', false],
    ])
  })

  it('are planned again when the rule changes, never next to a skipped one', async () => {
    const { workspaceId, ruleId } = await workspaceWithRent('Replanned')
    await skip(ruleId, '2026-10-13')

    await changeRecurrenceRule(
      databases.app,
      { workspaceId, ruleId },
      {
        amountCents: 210_000,
        schedule: {
          frequency: 'monthly',
          dayOfMonth: 15,
          weekendRule: 'next_business_day',
          startsOn: '2026-10-15',
          endsOn: '2027-01-31',
        },
      },
      FIRST_OF_OCTOBER,
    )

    expect(await dueDates(workspaceId)).toEqual([
      '2026-10-13 skipped',
      '2026-11-16 pending',
      '2026-12-15 pending',
      '2027-01-15 pending',
    ])
    const [planned] = await listOccurrences(
      databases.app,
      workspaceId,
      { from: '2026-11-01', to: '2026-11-30' },
      FIRST_OF_OCTOBER,
    )
    expect(planned?.amountCents).toBe(210_000)
  })

  it('never plan the past of a rule that started before today', async () => {
    const { workspaceId, ruleId } = await workspaceWithRent('Started long ago')
    await changeRecurrenceRule(
      databases.app,
      { workspaceId, ruleId },
      { schedule: { frequency: 'monthly', dayOfMonth: 10, startsOn: '2026-01-10' } },
      FIRST_OF_OCTOBER,
    )
    const [first] = await listOccurrences(
      databases.app,
      workspaceId,
      { from: '2026-01-01', to: '2026-12-31' },
      FIRST_OF_OCTOBER,
    )
    expect(first?.dueOn).toBe('2026-10-10')
  })

  it('never plan a second one next to an unpaid one when the day changes', async () => {
    const { workspaceId, ruleId } = await workspaceWithRent('Unpaid then moved')
    await changeRecurrenceRule(
      databases.app,
      { workspaceId, ruleId },
      { schedule: { frequency: 'monthly', dayOfMonth: 20, startsOn: '2026-10-20' } },
      MID_DECEMBER,
    )
    const december = await listOccurrences(
      databases.app,
      workspaceId,
      { from: '2026-12-01', to: '2026-12-31' },
      MID_DECEMBER,
    )
    expect(december.map((occurrence) => occurrence.dueOn)).toEqual(['2026-12-10'])
  })

  it('count holidays earlier in the first month when finding a business day', async () => {
    const { workspaceId } = await fixtures.createWorkspaceOwnedBy(userId, 'Salary')
    const checking = await accountIn(workspaceId, 'checking', 'Conta X')
    const salary = await accountIn(workspaceId, 'expense_category', 'Transferência')
    const thirdOfNovember = { now: () => new Date('2026-11-03T12:00:00Z') }
    await createRecurrenceRule(
      databases.app,
      { workspaceId, userId },
      {
        description: 'Reserva mensal',
        entryType: 'expense',
        amountCents: 50_000,
        sourceAccountId: checking,
        categoryAccountId: salary,
        schedule: { frequency: 'monthly', nthBusinessDay: 5, startsOn: '2026-11-01' },
      },
      thirdOfNovember,
    )
    const [first] = await listOccurrences(
      databases.app,
      workspaceId,
      { from: '2026-11-01', to: '2026-11-30' },
      thirdOfNovember,
    )
    expect(first?.dueOn).toBe('2026-11-09')
  })

  it('leave with their rule, except the ones already settled', async () => {
    const { workspaceId, ruleId } = await workspaceWithRent('Deleted rule')
    await skip(ruleId, '2026-11-10')

    await deleteRecurrenceRule(databases.app, { workspaceId, ruleId, userId })

    expect(await dueDates(workspaceId)).toEqual(['2026-11-10 skipped'])
  })
})
