import { createApp } from '@api/app'
import { createAccount, createCard, deleteEntry, recordEntry } from '@api/modules/ledger'
import { createGoal, createRecurrenceRule, setBudget } from '@api/modules/planning'
import { getPeriodOverview, type PeriodOverview } from '@api/modules/reports'
import { changeWorkspaceSettings } from '@api/modules/workspaces'
import { testAppDeps } from '@api/testing/app'
import { connectTestDatabases } from '@api/testing/database'
import { createFixtures } from '@api/testing/fixtures'
import { addMemberWithSystemRole, loggedInUser, requestsAs } from '@api/testing/http'
import { afterAll, describe, expect, it } from 'vitest'

const databases = connectTestDatabases()
const fixtures = createFixtures(databases.owner, databases.app)
const MID_OCTOBER = { now: () => new Date('2026-10-15T12:00:00Z') }

afterAll(async () => {
  await fixtures.removeEverything()
  await databases.closeAll()
})

async function household() {
  const userId = await fixtures.createUser(`overview-${crypto.randomUUID()}`)
  const { workspaceId } = await fixtures.createWorkspaceOwnedBy(userId, 'Overview')
  const context = { workspaceId, userId }
  const account = async (input: Record<string, unknown>) =>
    (await createAccount(databases.app, context, input)).accountId
  const checking = await account({ kind: 'checking', name: 'Conta X' })
  const salary = await account({ kind: 'income_category', name: 'Salário', incomeNature: 'fixed' })
  const commission = await account({
    kind: 'income_category',
    name: 'Comissão',
    incomeNature: 'variable',
  })
  const groceries = await account({ kind: 'expense_category', name: 'Mercado' })
  const housing = await account({ kind: 'expense_category', name: 'Moradia' })
  const card = (
    await createCard(databases.app, context, { name: 'Card X', closingDay: 3, dueDay: 10 })
  ).accountId
  const entry = (input: Record<string, unknown>) =>
    recordEntry(databases.app, { ...context, source: 'web' }, input, MID_OCTOBER)

  await entry({
    entryType: 'income',
    occurredOn: '2026-10-05',
    description: 'Salário A',
    amountCents: 500_000,
    receivedInAccountId: checking,
    categoryId: salary,
  })
  await entry({
    entryType: 'income',
    occurredOn: '2026-10-10',
    description: 'Comissão',
    amountCents: 120_000,
    receivedInAccountId: checking,
    categoryId: commission,
  })
  await entry({
    entryType: 'expense',
    occurredOn: '2026-10-12',
    description: 'Feira',
    amountCents: 30_000,
    paidFromAccountId: checking,
    categoryId: groceries,
  })
  await entry({
    entryType: 'card_purchase',
    occurredOn: '2026-10-14',
    description: 'Geladeira',
    amountCents: 90_000,
    installmentCount: 3,
    cardAccountId: card,
    categoryId: groceries,
  })
  await entry({
    entryType: 'income',
    occurredOn: '2026-08-10',
    description: 'Comissão de agosto',
    amountCents: 60_000,
    receivedInAccountId: checking,
    categoryId: commission,
  })
  await entry({
    entryType: 'expense',
    occurredOn: '2026-08-12',
    description: 'Feira de agosto',
    amountCents: 40_000,
    paidFromAccountId: checking,
    categoryId: housing,
  })
  const reserve = await account({ kind: 'savings', name: 'Reserva' })
  await createGoal(databases.app, context, {
    name: 'Reserva',
    targetCents: 1_000_000,
    accountId: reserve,
    isReserve: true,
  })
  await entry({
    entryType: 'transfer',
    occurredOn: '2026-10-01',
    description: 'Guardar',
    amountCents: 300_000,
    fromAccountId: checking,
    toAccountId: reserve,
  })
  const mistake = await entry({
    entryType: 'expense',
    occurredOn: '2026-10-13',
    description: 'Lançado duas vezes',
    amountCents: 50_000,
    paidFromAccountId: checking,
    categoryId: groceries,
  })
  await deleteEntry(databases.app, { ...context, entryId: mistake.entryId })
  const rule = (input: Record<string, unknown>) =>
    createRecurrenceRule(databases.app, context, input, MID_OCTOBER)
  await rule({
    description: 'Salário B',
    entryType: 'income',
    amountCents: 400_000,
    sourceAccountId: checking,
    categoryAccountId: salary,
    schedule: { frequency: 'monthly', dayOfMonth: 20, startsOn: '2026-10-20' },
  })
  await rule({
    description: 'Aluguel',
    entryType: 'expense',
    amountCents: 200_000,
    sourceAccountId: checking,
    categoryAccountId: housing,
    schedule: { frequency: 'monthly', dayOfMonth: 25, startsOn: '2026-10-25' },
  })
  await rule({
    description: 'Streaming',
    entryType: 'card_purchase',
    amountCents: 3_990,
    sourceAccountId: card,
    categoryAccountId: groceries,
    schedule: { frequency: 'monthly', dayOfMonth: 20, startsOn: '2026-10-20' },
  })
  await setBudget(
    databases.app,
    { workspaceId, categoryAccountId: groceries },
    { limitCents: 100_000, fromPeriod: '2026-10' },
  )
  return { workspaceId, userId, groceries, card }
}

describe('getPeriodOverview', () => {
  it('puts the ledger, the plan and the settings together for the current period', async () => {
    const { workspaceId, groceries, card } = await household()
    const overview = await getPeriodOverview(databases.app, workspaceId, {}, MID_OCTOBER)

    expect(overview.today).toBe('2026-10-15')
    expect(overview.period).toEqual({ label: '2026-10', start: '2026-10-01', end: '2026-10-31' })
    expect(overview.metrics).toMatchObject({
      fixedIncome: 900_000,
      variableIncome: 120_000,
      budgetIncome: 900_000,
      committed: 203_990,
    })
    const { spent, freeToSpend, dailyAllowance } = overview.metrics
    expect(freeToSpend).toBe(900_000 - spent - 203_990)
    expect(dailyAllowance).toBe(Math.floor(freeToSpend / 17))
    expect(overview.metrics.committedAhead.map((period) => period.label)).toEqual([
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
      '2027-03',
      '2027-04',
    ])
    expect(overview.metrics.committedAhead[0]).toMatchObject({
      plannedCents: 203_990,
      fixedIncomeCents: 400_000,
    })
    const installments = overview.metrics.committedAhead.map((period) => period.installmentsCents)
    expect(installments.reduce((sum, cents) => sum + cents, 0)).toBe(
      90_000 - (overview.metrics.spent - 30_000),
    )
    expect(overview.metrics.nextInvoice).toEqual([
      {
        cardAccountId: card,
        closingOn: '2026-11-03',
        dueOn: '2026-11-10',
        postedCents: 30_000,
        plannedCents: 3_990,
        forecastCents: 33_990,
      },
    ])
    expect(overview.metrics.variableAverage).toBe(60_000)
    expect(overview.metrics.reserveCoverage).toEqual({
      savedCents: 300_000,
      targetCents: 1_000_000,
      monthlySpendingCents: 40_000,
      months: 7.5,
    })
    expect(overview.metrics.budgetPace).toEqual([
      expect.objectContaining({
        categoryAccountId: groceries,
        limitCents: 100_000,
        spentCents: spent,
      }),
    ])
  })

  it('follows the budget view and the financial period of the workspace', async () => {
    const { workspaceId, groceries } = await household()
    await changeWorkspaceSettings(databases.app, workspaceId, {
      installmentBudgetView: 'purchase_month',
    })
    const byPurchase = await getPeriodOverview(databases.app, workspaceId, {}, MID_OCTOBER)
    expect(byPurchase.metrics.spent).toBe(30_000 + 90_000)
    expect(byPurchase.insights).toContainEqual({
      code: 'budget_over',
      severity: 'alert',
      subject: groceries,
      values: { limitCents: 100_000, spentCents: 120_000 },
    })

    await changeWorkspaceSettings(databases.app, workspaceId, {
      periodAnchor: 'day_of_month',
      periodAnchorValue: 20,
    })
    const bySalaryDay = await getPeriodOverview(databases.app, workspaceId, {}, MID_OCTOBER)
    expect(bySalaryDay.period).toEqual({ label: '2026-09', start: '2026-09-20', end: '2026-10-19' })
    const next = await getPeriodOverview(
      databases.app,
      workspaceId,
      { period: '2026-10' },
      MID_OCTOBER,
    )
    expect(next.period).toEqual({ label: '2026-10', start: '2026-10-20', end: '2026-11-19' })
    expect(next.metrics.committed).toBe(203_990)
  })
})

describe('committedAhead', () => {
  it('sees the coming installments of a purchase made long before the recent periods', async () => {
    const userId = await fixtures.createUser(`ahead-${crypto.randomUUID()}`)
    const { workspaceId } = await fixtures.createWorkspaceOwnedBy(userId, 'Ahead')
    const context = { workspaceId, userId }
    const furniture = (
      await createAccount(databases.app, context, { kind: 'expense_category', name: 'Móveis' })
    ).accountId
    const card = (
      await createCard(databases.app, context, { name: 'Card Y', closingDay: 3, dueDay: 10 })
    ).accountId
    await recordEntry(
      databases.app,
      { ...context, source: 'web' },
      {
        entryType: 'card_purchase',
        occurredOn: '2026-01-10',
        description: 'Sofá',
        amountCents: 120_000,
        installmentCount: 12,
        firstInstallment: 10,
        cardAccountId: card,
        categoryId: furniture,
      },
      MID_OCTOBER,
    )

    const { metrics } = await getPeriodOverview(databases.app, workspaceId, {}, MID_OCTOBER)
    const ahead = metrics.committedAhead.reduce((sum, period) => sum + period.installmentsCents, 0)
    expect(ahead + metrics.spent).toBe(30_000)
    expect(ahead).toBeGreaterThan(0)
  })
})

describe('GET /overview', () => {
  it('answers anyone who may view reports, for the current or a chosen period', async () => {
    const app = createApp(testAppDeps({ db: databases.app }))
    const ownerSession = await loggedInUser(app, databases.app, fixtures.runId, 'overview-owner')
    const viewerSession = await loggedInUser(app, databases.app, fixtures.runId, 'overview-viewer')
    const { workspaceId } = await fixtures.createWorkspaceOwnedBy(
      ownerSession.userId,
      'Overview HTTP',
    )
    await addMemberWithSystemRole(
      databases.app,
      databases.owner,
      workspaceId,
      viewerSession.userId,
      'viewer',
    )
    const viewer = requestsAs(app, viewerSession)

    const response = await viewer.get(`/api/workspaces/${workspaceId}/overview?period=2027-01`)
    expect(response.status).toBe(200)
    const overview = (await response.json()) as PeriodOverview
    expect(overview.period.label).toBe('2027-01')
    expect(overview.metrics.freeToSpend).toBe(0)

    const invalid = await viewer.get(`/api/workspaces/${workspaceId}/overview?period=2027-1`)
    expect(invalid.status).toBe(400)
  })
})
