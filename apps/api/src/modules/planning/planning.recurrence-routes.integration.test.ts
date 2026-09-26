import { createApp } from '@api/app'
import type { RecurrenceRuleItem } from '@api/modules/planning'
import { testAppDeps } from '@api/testing/app'
import { connectTestDatabases } from '@api/testing/database'
import { createFixtures } from '@api/testing/fixtures'
import { addMemberWithSystemRole, loggedInUser, requestsAs } from '@api/testing/http'
import type { SessionRequests } from '@api/testing/testing.types'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const databases = connectTestDatabases()
const fixtures = createFixtures(databases.owner, databases.app)
const app = createApp(testAppDeps({ db: databases.app }))
const UNKNOWN_ID = '01900000-0000-7000-8000-000000000000'

let owner: SessionRequests
let member: SessionRequests
let viewer: SessionRequests
let rulesPath: string
let checkingId: string
let housingId: string
let salaryId: string
let cardId: string
let foreignCategoryId: string

beforeAll(async () => {
  const ownerSession = await loggedInUser(app, databases.app, fixtures.runId, 'rules-owner')
  const memberSession = await loggedInUser(app, databases.app, fixtures.runId, 'rules-member')
  const viewerSession = await loggedInUser(app, databases.app, fixtures.runId, 'rules-viewer')
  const { workspaceId } = await fixtures.createWorkspaceOwnedBy(ownerSession.userId, 'Rules')
  const foreign = await fixtures.createWorkspaceOwnedBy(memberSession.userId, 'Foreign rules')
  for (const [session, role] of [
    [memberSession, 'member'],
    [viewerSession, 'viewer'],
  ] as const) {
    await addMemberWithSystemRole(databases.app, databases.owner, workspaceId, session.userId, role)
  }
  owner = requestsAs(app, ownerSession)
  member = requestsAs(app, memberSession)
  viewer = requestsAs(app, viewerSession)
  const workspacePath = `/api/workspaces/${workspaceId}`
  rulesPath = `${workspacePath}/recurrences`
  checkingId = await created(
    owner.post(`${workspacePath}/accounts`, { kind: 'checking', name: 'Conta X' }),
  )
  housingId = await created(
    owner.post(`${workspacePath}/accounts`, { kind: 'expense_category', name: 'Moradia' }),
  )
  salaryId = await created(
    owner.post(`${workspacePath}/accounts`, {
      kind: 'income_category',
      name: 'Salário',
      incomeNature: 'fixed',
    }),
  )
  cardId = await created(
    owner.post(`${workspacePath}/cards`, { name: 'Card X', closingDay: 3, dueDay: 10 }),
  )
  foreignCategoryId = await created(
    member.post(`/api/workspaces/${foreign.workspaceId}/accounts`, {
      kind: 'expense_category',
      name: 'Alheia',
    }),
  )
})

afterAll(async () => {
  await fixtures.removeEverything()
  await databases.closeAll()
})

async function created(response: Promise<Response>): Promise<string> {
  const body = (await (await response).json()) as { accountId?: string; ruleId?: string }
  const id = body.accountId ?? body.ruleId
  if (!id) {
    throw new Error(`Nothing was created: ${JSON.stringify(body)}`)
  }
  return id
}

async function codeOf(response: Response): Promise<string> {
  return ((await response.json()) as { error: { code: string } }).error.code
}

async function rules(): Promise<RecurrenceRuleItem[]> {
  return (await (await viewer.get(rulesPath)).json()) as RecurrenceRuleItem[]
}

function rent(overrides: Record<string, unknown> = {}) {
  return {
    description: 'Aluguel',
    entryType: 'expense',
    amountCents: 200_000,
    sourceAccountId: checkingId,
    categoryAccountId: housingId,
    schedule: {
      frequency: 'monthly',
      dayOfMonth: 10,
      weekendRule: 'next_business_day',
      startsOn: '2026-10-10',
    },
    ...overrides,
  }
}

describe('POST /recurrences', () => {
  it('creates bills, incomes and card subscriptions, listed with their schedule', async () => {
    const rentId = await created(member.post(rulesPath, rent()))
    await created(
      member.post(rulesPath, {
        description: 'Salário A',
        entryType: 'income',
        amountCents: 500_000,
        sourceAccountId: checkingId,
        categoryAccountId: salaryId,
        schedule: { frequency: 'monthly', nthBusinessDay: 5, startsOn: '2026-10-01' },
      }),
    )
    await created(
      member.post(
        rulesPath,
        rent({
          description: 'Streaming',
          entryType: 'card_purchase',
          amountCents: 3990,
          sourceAccountId: cardId,
          schedule: { frequency: 'monthly', startsOn: '2026-10-15' },
        }),
      ),
    )

    expect((await rules()).find((rule) => rule.id === rentId)).toEqual({
      id: rentId,
      description: 'Aluguel',
      entryType: 'expense',
      amountCents: 200_000,
      amountIsEstimate: false,
      sourceAccountId: checkingId,
      categoryAccountId: housingId,
      schedule: {
        frequency: 'monthly',
        interval: 1,
        dayOfMonth: 10,
        nthBusinessDay: null,
        weekendRule: 'next_business_day',
        startsOn: '2026-10-10',
        endsOn: null,
      },
      remindDaysBefore: null,
      autoRecord: false,
    })
  })

  it('refuses a viewer, accounts that do not fit, a foreign account and a bad schedule', async () => {
    expect((await viewer.post(rulesPath, rent())).status).toBe(403)

    for (const body of [
      rent({ categoryAccountId: salaryId }),
      rent({ sourceAccountId: cardId }),
      rent({ categoryAccountId: foreignCategoryId }),
    ]) {
      const response = await member.post(rulesPath, body)
      expect([response.status, await codeOf(response)]).toEqual([
        400,
        'RECURRENCE_ACCOUNTS_INVALID',
      ])
    }

    for (const body of [
      rent({
        schedule: {
          frequency: 'monthly',
          dayOfMonth: 10,
          nthBusinessDay: 5,
          startsOn: '2026-10-10',
        },
      }),
      rent({ amountCents: 0 }),
      rent({ autoPay: true }),
    ]) {
      const response = await member.post(rulesPath, body)
      expect([response.status, await codeOf(response)]).toEqual([400, 'RECURRENCE_INVALID'])
    }
  })
})

describe('PATCH /recurrences/:ruleId', () => {
  it('changes only what is sent, never the entry type', async () => {
    const ruleId = await created(member.post(rulesPath, rent({ description: 'Condomínio' })))
    const changed = await member.patch(`${rulesPath}/${ruleId}`, {
      amountCents: 80_000,
      amountIsEstimate: true,
      schedule: {
        frequency: 'monthly',
        dayOfMonth: 5,
        startsOn: '2026-11-05',
        endsOn: '2027-10-05',
      },
    })
    expect(changed.status).toBe(204)
    expect((await rules()).find((rule) => rule.id === ruleId)).toMatchObject({
      amountCents: 80_000,
      amountIsEstimate: true,
      schedule: {
        dayOfMonth: 5,
        weekendRule: 'keep',
        startsOn: '2026-11-05',
        endsOn: '2027-10-05',
      },
    })

    await member.patch(`${rulesPath}/${ruleId}`, { description: 'Condomínio novo' })
    expect((await rules()).find((rule) => rule.id === ruleId)).toMatchObject({
      description: 'Condomínio novo',
      amountIsEstimate: true,
    })

    const typeChange = await member.patch(`${rulesPath}/${ruleId}`, { entryType: 'income' })
    expect([typeChange.status, await codeOf(typeChange)]).toEqual([400, 'RECURRENCE_INVALID'])
    const wrongCategory = await member.patch(`${rulesPath}/${ruleId}`, {
      categoryAccountId: salaryId,
    })
    expect([wrongCategory.status, await codeOf(wrongCategory)]).toEqual([
      400,
      'RECURRENCE_ACCOUNTS_INVALID',
    ])
    const nothing = await member.patch(`${rulesPath}/${ruleId}`, {})
    expect([nothing.status, await codeOf(nothing)]).toEqual([400, 'RECURRENCE_INVALID'])
  })

  it('answers 404 for an unknown or malformed rule', async () => {
    for (const ruleId of [UNKNOWN_ID, 'not-a-uuid']) {
      const response = await member.patch(`${rulesPath}/${ruleId}`, { amountCents: 1 })
      expect([response.status, await codeOf(response)]).toEqual([404, 'RECURRENCE_NOT_FOUND'])
    }
  })
})

describe('DELETE /recurrences/:ruleId', () => {
  it('lets roles with planning:delete remove a rule, which then is gone', async () => {
    const ruleId = await created(member.post(rulesPath, rent({ description: 'Academia' })))
    expect((await member.del(`${rulesPath}/${ruleId}`)).status).toBe(403)
    expect((await owner.del(`${rulesPath}/${ruleId}`, { reason: 'Cancelada' })).status).toBe(204)

    expect((await rules()).map((rule) => rule.id)).not.toContain(ruleId)
    const again = await owner.del(`${rulesPath}/${ruleId}`)
    expect([again.status, await codeOf(again)]).toEqual([404, 'RECURRENCE_NOT_FOUND'])
    expect((await member.patch(`${rulesPath}/${ruleId}`, { amountCents: 1 })).status).toBe(404)
  })
})
