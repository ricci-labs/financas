import { withWorkspace } from '@api/core/db/tx'
import { forEachWorkspace } from '@api/jobs/for-each-workspace'
import { planOccurrencesJob } from '@api/jobs/plan-occurrences'
import { ledgerAccounts } from '@api/modules/ledger/ledger.table'
import { createRecurrenceRule } from '@api/modules/planning'
import { plannedOccurrences } from '@api/modules/planning/planning.table'
import { listJobWorkspaceIds } from '@api/modules/workspaces'
import { workspaces } from '@api/modules/workspaces/workspaces.table'
import { TEST_PUBLIC_URL } from '@api/testing/app'
import { connectTestDatabases } from '@api/testing/database'
import { createFixtures } from '@api/testing/fixtures'
import { createCapturingLogger } from '@api/testing/logger'
import { createRecordingMailer } from '@api/testing/mailer'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const databases = connectTestDatabases()
const fixtures = createFixtures(databases.owner, databases.app)
const FIRST_OF_OCTOBER = { now: () => new Date('2026-10-01T12:00:00Z') }
const MID_DECEMBER = { now: () => new Date('2026-12-15T12:00:00Z') }

let userId: string

beforeAll(async () => {
  userId = await fixtures.createUser('jobs')
})

afterAll(async () => {
  await fixtures.removeEverything()
  await databases.closeAll()
})

function jobDeps(clock = FIRST_OF_OCTOBER) {
  const capturing = createCapturingLogger()
  const deps = {
    db: databases.app,
    clock,
    logger: capturing.logger,
    mailer: createRecordingMailer().mailer,
    publicUrl: TEST_PUBLIC_URL,
  }
  return { deps, entries: capturing.entries }
}

describe('job_workspace_ids', () => {
  it('lists the active workspaces only', async () => {
    const active = (await fixtures.createWorkspaceOwnedBy(userId, 'Active')).workspaceId
    const archived = (await fixtures.createWorkspaceOwnedBy(userId, 'Archived')).workspaceId
    const deleted = (await fixtures.createWorkspaceOwnedBy(userId, 'Deleted')).workspaceId
    await databases.owner
      .update(workspaces)
      .set({ archivedAt: new Date() })
      .where(eq(workspaces.id, archived))
    await databases.owner
      .update(workspaces)
      .set({ deletedAt: new Date() })
      .where(eq(workspaces.id, deleted))

    const ids = await listJobWorkspaceIds(databases.app)
    expect(ids).toContain(active)
    expect(ids).not.toContain(archived)
    expect(ids).not.toContain(deleted)
  })
})

describe('forEachWorkspace', () => {
  it('keeps going when one workspace fails, and logs which one', async () => {
    const failing = (await fixtures.createWorkspaceOwnedBy(userId, 'Failing')).workspaceId
    const fine = (await fixtures.createWorkspaceOwnedBy(userId, 'Fine')).workspaceId
    const { deps, entries } = jobDeps()
    const visited: string[] = []

    const result = await forEachWorkspace(deps, async (workspaceId) => {
      visited.push(workspaceId)
      if (workspaceId === failing) {
        throw new Error('broken workspace')
      }
    })

    expect(visited).toEqual(expect.arrayContaining([failing, fine]))
    expect(result.failedWorkspaces).toBe(1)
    expect(result.workspaces).toBe(visited.length - 1)
    expect(entries()).toContainEqual(
      expect.objectContaining({ event: 'job.workspace.failed', workspaceId: failing }),
    )
  })
})

describe('plan-occurrences job', () => {
  it('moves the six-month horizon of every workspace forward at night', async () => {
    const { workspaceId } = await fixtures.createWorkspaceOwnedBy(userId, 'Horizon job')
    const [checking, rent] = await withWorkspace(databases.app, workspaceId, (tx) =>
      tx
        .insert(ledgerAccounts)
        .values([
          { workspaceId, kind: 'checking', name: 'Conta X', currency: 'BRL' },
          { workspaceId, kind: 'expense_category', name: 'Moradia', currency: 'BRL' },
        ])
        .returning({ id: ledgerAccounts.id }),
    )
    const { ruleId } = await createRecurrenceRule(
      databases.app,
      { workspaceId, userId },
      {
        description: 'Aluguel',
        entryType: 'expense',
        amountCents: 100_000,
        sourceAccountId: checking?.id,
        categoryAccountId: rent?.id,
        schedule: { frequency: 'monthly', dayOfMonth: 10, startsOn: '2026-10-10' },
      },
      FIRST_OF_OCTOBER,
    )
    const lastDueOn = async () => {
      const rows = await databases.owner
        .select({ dueOn: plannedOccurrences.dueOn })
        .from(plannedOccurrences)
        .where(eq(plannedOccurrences.ruleId, ruleId))
      return rows
        .map((row) => row.dueOn)
        .sort()
        .at(-1)
    }
    expect(await lastDueOn()).toBe('2027-04-10')

    const result = await planOccurrencesJob.run(jobDeps(MID_DECEMBER).deps)

    expect(await lastDueOn()).toBe('2027-06-10')
    expect(result.failedWorkspaces).toBe(0)
  })
})
