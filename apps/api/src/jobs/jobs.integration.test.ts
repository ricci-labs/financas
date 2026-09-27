import { withWorkspace } from '@api/core/db/tx'
import { forEachWorkspace } from '@api/jobs/for-each-workspace'
import { planOccurrencesJob } from '@api/jobs/plan-occurrences'
import { purgeTrashedFilesJob } from '@api/jobs/purge-trashed-files'
import { entryAttachments, files } from '@api/modules/attachments/attachments.table'
import { recordEntry } from '@api/modules/ledger'
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
import { createMemoryFileStorage } from '@api/testing/storage'
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

function jobDeps(clock = FIRST_OF_OCTOBER, files = createMemoryFileStorage()) {
  const capturing = createCapturingLogger()
  const deps = {
    db: databases.app,
    clock,
    logger: capturing.logger,
    mailer: createRecordingMailer().mailer,
    publicUrl: TEST_PUBLIC_URL,
    fileStorage: files.storage,
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

describe('purge-trashed-files job', () => {
  it('removes files trashed more than 30 days ago, with their bytes, and nothing else', async () => {
    const { workspaceId } = await fixtures.createWorkspaceOwnedBy(userId, 'Purge job')
    const storage = createMemoryFileStorage()
    const daysAgo = (days: number) => new Date(MID_DECEMBER.now().getTime() - days * 86_400_000)
    const file = async (label: string, deletedAt: Date | null) => {
      const sha256 = label.repeat(64)
      const storageKey = `${workspaceId}/${sha256}`
      await storage.storage.put(storageKey, new Uint8Array([1]))
      const [row] = await databases.owner
        .insert(files)
        .values({
          workspaceId,
          storageKey,
          mimeType: 'image/jpeg',
          sizeBytes: 1,
          sha256,
          originalName: `${label}.jpg`,
          uploadedByUserId: userId,
          source: 'web',
          deletedAt,
          deletedByUserId: deletedAt && userId,
        })
        .returning({ id: files.id })
      return { id: row?.id ?? '', storageKey }
    }
    await file('a', daysAgo(31))
    const recent = await file('b', daysAgo(29))
    const active = await file('c', null)
    const stillLinked = await file('d', daysAgo(40))
    const [checking, groceries] = await withWorkspace(databases.app, workspaceId, (tx) =>
      tx
        .insert(ledgerAccounts)
        .values([
          { workspaceId, kind: 'checking', name: 'Conta X', currency: 'BRL' },
          { workspaceId, kind: 'expense_category', name: 'Mercado', currency: 'BRL' },
        ])
        .returning({ id: ledgerAccounts.id }),
    )
    const entry = await recordEntry(
      databases.app,
      { workspaceId, userId, source: 'web' },
      {
        entryType: 'expense',
        occurredOn: '2026-10-05',
        description: 'Nota',
        amountCents: 1000,
        paidFromAccountId: checking?.id,
        categoryId: groceries?.id,
      },
    )
    await databases.owner.insert(entryAttachments).values({
      workspaceId,
      entryId: entry.entryId,
      fileId: stillLinked.id,
      attachedByUserId: userId,
    })

    const result = await purgeTrashedFilesJob.run(jobDeps(MID_DECEMBER, storage).deps)

    const remaining = await databases.owner
      .select({ id: files.id })
      .from(files)
      .where(eq(files.workspaceId, workspaceId))
    expect(remaining.map((row) => row.id).sort()).toEqual(
      [recent.id, active.id, stillLinked.id].sort(),
    )
    expect([...storage.stored.keys()].sort()).toEqual(
      [recent.storageKey, active.storageKey, stillLinked.storageKey].sort(),
    )
    expect(result).toMatchObject({ purged: 1, failedWorkspaces: 0 })
  })
})
