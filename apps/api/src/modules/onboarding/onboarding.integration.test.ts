import { withWorkspace } from '@api/core/db/tx'
import { ValidationError } from '@api/core/http/errors'
import { rolePermissions, roles } from '@api/modules/access/access.table'
import { ledgerAccounts } from '@api/modules/ledger/ledger.table'
import { memberships } from '@api/modules/members/members.table'
import { createWorkspace } from '@api/modules/onboarding'
import { workspaces } from '@api/modules/workspaces/workspaces.table'
import { connectTestDatabases } from '@api/testing/database'
import { createFixtures } from '@api/testing/fixtures'
import { ROLE_TEMPLATES, SYSTEM_ACCOUNT_KINDS, SYSTEM_ACCOUNT_NAMES } from '@financas/shared'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const databases = connectTestDatabases()
const fixtures = createFixtures(databases.owner, databases.app)

let ownerUserId: string
let otherWorkspace: string

beforeAll(async () => {
  ownerUserId = await fixtures.createUser('onboarding')
  otherWorkspace = (await fixtures.createWorkspaceOwnedBy(ownerUserId, 'Other')).workspaceId
})

afterAll(async () => {
  await fixtures.removeEverything()
  await databases.closeAll()
})

function permissionKeys(permissions: readonly { module: string; action: string }[]): string[] {
  return permissions.map(({ module, action }) => `${module}:${action}`).sort()
}

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

  it('creates the system accounts in the workspace currency, at the root', async () => {
    const { workspaceId } = await fixtures.createWorkspaceOwnedBy(ownerUserId, 'Contas')
    const accounts = await withWorkspace(databases.app, workspaceId, (tx) =>
      tx
        .select({
          kind: ledgerAccounts.kind,
          name: ledgerAccounts.name,
          currency: ledgerAccounts.currency,
          parentId: ledgerAccounts.parentId,
          isSystem: ledgerAccounts.isSystem,
        })
        .from(ledgerAccounts),
    )
    expect(accounts.sort((a, b) => a.kind.localeCompare(b.kind))).toEqual(
      [...SYSTEM_ACCOUNT_KINDS].sort().map((kind) => ({
        kind,
        name: SYSTEM_ACCOUNT_NAMES[kind],
        currency: 'BRL',
        parentId: null,
        isSystem: true,
      })),
    )
  })

  it('keeps the new workspace invisible from another workspace', async () => {
    const { workspaceId } = await fixtures.createWorkspaceOwnedBy(ownerUserId, 'Pessoal')
    const seenFromOther = await withWorkspace(databases.app, otherWorkspace, (tx) =>
      tx.select({ id: roles.id }).from(roles).where(eq(roles.workspaceId, workspaceId)),
    )
    expect(seenFromOther).toEqual([])
  })

  it('rejects a blank name before touching the database', async () => {
    const blankName = createWorkspace(databases.app, { name: '   ', ownerUserId })
    await expect(blankName).rejects.toBeInstanceOf(ValidationError)
  })
})
