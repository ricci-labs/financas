import { createApp } from '@api/app'
import type { HolidaysOfYear } from '@api/modules/planning'
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
let holidaysPath: string

beforeAll(async () => {
  const ownerSession = await loggedInUser(app, databases.app, fixtures.runId, 'holidays-owner')
  const memberSession = await loggedInUser(app, databases.app, fixtures.runId, 'holidays-member')
  const viewerSession = await loggedInUser(app, databases.app, fixtures.runId, 'holidays-viewer')
  const { workspaceId } = await fixtures.createWorkspaceOwnedBy(ownerSession.userId, 'Holidays')
  for (const [session, role] of [
    [memberSession, 'member'],
    [viewerSession, 'viewer'],
  ] as const) {
    await addMemberWithSystemRole(databases.app, databases.owner, workspaceId, session.userId, role)
  }
  owner = requestsAs(app, ownerSession)
  member = requestsAs(app, memberSession)
  viewer = requestsAs(app, viewerSession)
  holidaysPath = `/api/workspaces/${workspaceId}/holidays`
})

afterAll(async () => {
  await fixtures.removeEverything()
  await databases.closeAll()
})

async function codeOf(response: Response): Promise<string> {
  return ((await response.json()) as { error: { code: string } }).error.code
}

async function holidaysOf(year: number): Promise<HolidaysOfYear> {
  return (await (await viewer.get(`${holidaysPath}?year=${year}`)).json()) as HolidaysOfYear
}

async function added(response: Response): Promise<string> {
  return ((await response.json()) as { holidayId: string }).holidayId
}

describe('GET /holidays', () => {
  it('lists the national holidays and the workspace ones of the year', async () => {
    await member.post(holidaysPath, { onDate: '2027-01-25', name: 'Aniversário da cidade' })
    await member.post(holidaysPath, { onDate: '2026-01-25', name: 'Aniversário da cidade' })

    const year = await holidaysOf(2027)
    expect(year.national).toContainEqual({ key: 'good_friday', on: '2027-03-26' })
    expect(year.workspace).toEqual([
      { id: expect.any(String), onDate: '2027-01-25', name: 'Aniversário da cidade' },
    ])
  })

  it('refuses a missing or absurd year', async () => {
    for (const query of ['', '?year=1500']) {
      const response = await viewer.get(`${holidaysPath}${query}`)
      expect([response.status, await codeOf(response)]).toEqual([400, 'HOLIDAY_QUERY_INVALID'])
    }
  })
})

describe('POST /holidays', () => {
  it('refuses a viewer, a day already taken, a national holiday and a blank name', async () => {
    expect((await viewer.post(holidaysPath, { onDate: '2026-03-19', name: 'X' })).status).toBe(403)

    expect(
      (await member.post(holidaysPath, { onDate: '2026-03-19', name: 'São José' })).status,
    ).toBe(201)
    const taken = await member.post(holidaysPath, { onDate: '2026-03-19', name: 'Outro' })
    expect([taken.status, await codeOf(taken)]).toEqual([409, 'HOLIDAY_DATE_TAKEN'])

    const national = await member.post(holidaysPath, { onDate: '2026-12-25', name: 'Natal' })
    expect([national.status, await codeOf(national)]).toEqual([409, 'HOLIDAY_ALREADY_NATIONAL'])

    const blank = await member.post(holidaysPath, { onDate: '2026-03-20', name: '  ' })
    expect([blank.status, await codeOf(blank)]).toEqual([400, 'HOLIDAY_INVALID'])
  })
})

describe('DELETE /holidays/:holidayId', () => {
  it('lets roles with planning:delete remove a holiday, which frees the day', async () => {
    const holidayId = await added(
      await owner.post(holidaysPath, { onDate: '2026-06-13', name: 'Santo Antônio' }),
    )
    expect((await member.del(`${holidaysPath}/${holidayId}`)).status).toBe(403)
    expect(
      (await owner.del(`${holidaysPath}/${holidayId}`, { reason: 'Não é feriado' })).status,
    ).toBe(204)
    expect((await holidaysOf(2026)).workspace.map((holiday) => holiday.id)).not.toContain(holidayId)
    expect((await owner.post(holidaysPath, { onDate: '2026-06-13', name: 'De novo' })).status).toBe(
      201,
    )
  })

  it('answers 404 for a holiday deleted twice, unknown or malformed', async () => {
    const holidayId = await added(
      await owner.post(holidaysPath, { onDate: '2026-08-06', name: 'Padroeiro' }),
    )
    await owner.del(`${holidaysPath}/${holidayId}`)
    for (const id of [holidayId, UNKNOWN_ID, 'not-a-uuid']) {
      const response = await owner.del(`${holidaysPath}/${id}`)
      expect([response.status, await codeOf(response)]).toEqual([404, 'HOLIDAY_NOT_FOUND'])
    }
  })
})
