import { withWorkspace } from '@api/core/db/tx'
import { ValidationError } from '@api/core/http/errors'
import { rolePermissions, roles } from '@api/modules/access/access.table'
import { memberships } from '@api/modules/members/members.table'
import { createWorkspace } from '@api/modules/workspaces'
import { workspaceSettings, workspaces } from '@api/modules/workspaces/workspaces.table'
import { connectTestDatabases, POSTGRES_ERRORS, postgresErrorCodeOf } from '@api/testing/database'
import { createFixtures } from '@api/testing/fixtures'
import { ROLE_TEMPLATES } from '@financas/shared'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const databases = connectTestDatabases()
const fixtures = createFixtures(databases.owner, databases.app)

let ownerUserId: string
let workspaceA: string
let workspaceB: string

beforeAll(async () => {
  ownerUserId = await fixtures.createUser('workspaces')
  workspaceA = (await fixtures.createWorkspaceOwnedBy(ownerUserId, 'A')).workspaceId
  workspaceB = (await fixtures.createWorkspaceOwnedBy(ownerUserId, 'B')).workspaceId
})

afterAll(async () => {
  await fixtures.removeEverything()
  await databases.closeAll()
})

function permissionKeys(permissions: readonly { module: string; action: string }[]): string[] {
  return permissions.map(({ module, action }) => `${module}:${action}`).sort()
}

describe('workspace isolation (RLS)', () => {
  it('shows no workspace at all when no workspace is set', async () => {
    const visible = await databases.app.select().from(workspaces)
    expect(visible).toEqual([])
  })

  it('shows only the current workspace', async () => {
    const visible = await withWorkspace(databases.app, workspaceA, (tx) =>
      tx.select({ id: workspaces.id }).from(workspaces),
    )
    expect(visible).toEqual([{ id: workspaceA }])
  })

  it('cannot update another workspace', async () => {
    const updated = await withWorkspace(databases.app, workspaceA, (tx) =>
      tx
        .update(workspaces)
        .set({ name: 'hijacked' })
        .where(eq(workspaces.id, workspaceB))
        .returning({ id: workspaces.id }),
    )
    expect(updated).toEqual([])

    const [untouched] = await databases.owner
      .select({ name: workspaces.name })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceB))
    expect(untouched?.name).toBe(`B ${fixtures.runId}`)
  })

  it('cannot insert a row for another workspace', async () => {
    const insertIntoOtherWorkspace = withWorkspace(databases.app, workspaceA, (tx) =>
      tx.insert(workspaces).values({ name: 'intruder', createdByUserId: ownerUserId }),
    )
    expect(await postgresErrorCodeOf(insertIntoOtherWorkspace)).toBe(
      POSTGRES_ERRORS.rowLevelSecurityViolation,
    )
  })

  it('does not leak the workspace setting after the transaction ends', async () => {
    await withWorkspace(databases.app, workspaceA, (tx) => tx.select().from(workspaces))
    const visibleAfterwards = await databases.app.select().from(workspaces)
    expect(visibleAfterwards).toEqual([])
  })
})

describe('createWorkspace', () => {
  it('creates the workspace, the four system roles with their matrix and the owner membership', async () => {
    const { workspaceId, ownerMembershipId } = await createWorkspace(databases.app, {
      name: `  Casa ${fixtures.runId}  `,
      ownerUserId,
    })

    const created = await withWorkspace(databases.app, workspaceId, async (tx) => ({
      workspace: await tx.select().from(workspaces),
      roles: await tx.select().from(roles),
      permissions: await tx.select().from(rolePermissions),
      memberships: await tx.select().from(memberships),
    }))

    expect(created.workspace).toMatchObject([{ id: workspaceId, name: `Casa ${fixtures.runId}` }])
    expect(created.roles.map((role) => role.systemKey).sort()).toEqual([
      'admin',
      'member',
      'owner',
      'viewer',
    ])

    for (const template of ROLE_TEMPLATES) {
      const role = created.roles.find((candidate) => candidate.systemKey === template.key)
      const granted = created.permissions.filter((permission) => permission.roleId === role?.id)
      expect(permissionKeys(granted)).toEqual(permissionKeys(template.permissions))
    }

    const ownerRole = created.roles.find((role) => role.systemKey === 'owner')
    expect(created.memberships).toMatchObject([
      { id: ownerMembershipId, userId: ownerUserId, roleId: ownerRole?.id },
    ])
  })

  it('keeps the new workspace invisible from another workspace', async () => {
    const { workspaceId } = await fixtures.createWorkspaceOwnedBy(ownerUserId, 'Pessoal')
    const seenFromA = await withWorkspace(databases.app, workspaceA, (tx) =>
      tx.select({ id: roles.id }).from(roles).where(eq(roles.workspaceId, workspaceId)),
    )
    expect(seenFromA).toEqual([])
  })

  it('rejects a blank name before touching the database', async () => {
    const blankName = createWorkspace(databases.app, { name: '   ', ownerUserId })
    await expect(blankName).rejects.toBeInstanceOf(ValidationError)
  })

  it('refuses a workspace created without an owner', async () => {
    const workspaceId = crypto.randomUUID()
    const ownerless = withWorkspace(databases.app, workspaceId, (tx) =>
      tx
        .insert(workspaces)
        .values({ id: workspaceId, name: 'no owner', createdByUserId: ownerUserId }),
    )
    expect(await postgresErrorCodeOf(ownerless)).toBe(POSTGRES_ERRORS.checkViolation)
  })
})

describe('workspace settings', () => {
  type SettingsChange = Partial<typeof workspaceSettings.$inferInsert>

  function updateSettingsOfA(change: SettingsChange) {
    return withWorkspace(databases.app, workspaceA, (tx) =>
      tx.update(workspaceSettings).set(change).where(eq(workspaceSettings.workspaceId, workspaceA)),
    )
  }

  it('are created with the workspace, with the documented defaults', async () => {
    const [settings] = await withWorkspace(databases.app, workspaceA, (tx) =>
      tx.select().from(workspaceSettings),
    )
    expect(settings).toMatchObject({
      workspaceId: workspaceA,
      currency: 'BRL',
      timezone: 'America/Sao_Paulo',
      locale: 'pt-BR',
      periodAnchor: 'calendar_month',
      periodAnchorValue: null,
      installmentBudgetView: 'per_installment',
      budgetBase: 'fixed_income',
      weekStartsOn: 0,
      pixReceivingKey: null,
      contactMessagesDailyCap: 20,
      chargeReminderEveryDays: 3,
    })
  })

  it('are isolated per workspace', async () => {
    const visible = await withWorkspace(databases.app, workspaceA, (tx) =>
      tx.select({ workspaceId: workspaceSettings.workspaceId }).from(workspaceSettings),
    )
    expect(visible).toEqual([{ workspaceId: workspaceA }])
  })

  it('accept a valid financial period', async () => {
    const fifthBusinessDay = updateSettingsOfA({
      periodAnchor: 'nth_business_day',
      periodAnchorValue: 5,
    })
    expect(await postgresErrorCodeOf(fifthBusinessDay)).toBeUndefined()
  })

  it.each<[string, SettingsChange]>([
    ['day of month without a day', { periodAnchor: 'day_of_month', periodAnchorValue: null }],
    ['day of month 32', { periodAnchor: 'day_of_month', periodAnchorValue: 32 }],
    ['calendar month with a day', { periodAnchor: 'calendar_month', periodAnchorValue: 5 }],
    ['11th business day', { periodAnchor: 'nth_business_day', periodAnchorValue: 11 }],
    ['a lowercase currency', { currency: 'brl' }],
    ['a Pix key without receiver', { pixReceivingKey: 'someone@example.test' }],
    [
      'a receiver name longer than Pix allows',
      {
        pixReceivingKey: 'someone@example.test',
        pixReceiverName: 'A name that is far too long for Pix',
        pixReceiverCity: 'Sao Paulo',
      },
    ],
    ['a negative daily cap', { contactMessagesDailyCap: -1 }],
    ['a zero-day reminder interval', { chargeReminderEveryDays: 0 }],
  ])('reject %s', async (_label, change) => {
    expect(await postgresErrorCodeOf(updateSettingsOfA(change))).toBe(
      POSTGRES_ERRORS.checkViolation,
    )
  })
})
