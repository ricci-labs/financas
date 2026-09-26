import { withWorkspace } from '@api/core/db/tx'
import { recordEntry } from '@api/modules/ledger'
import { ledgerAccounts } from '@api/modules/ledger/ledger.table'
import {
  createRecurrenceRule,
  listOccurrences,
  matchOccurrence,
  suggestOccurrencesForEntry,
  unmatchOccurrence,
} from '@api/modules/planning'
import { connectTestDatabases } from '@api/testing/database'
import { createFixtures } from '@api/testing/fixtures'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const databases = connectTestDatabases()
const fixtures = createFixtures(databases.owner, databases.app)
const FIRST_OF_OCTOBER = { now: () => new Date('2026-10-01T12:00:00Z') }
const OCTOBER = { from: '2026-10-01', to: '2026-10-31' }

let userId: string

beforeAll(async () => {
  userId = await fixtures.createUser('matching')
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

async function household(name: string) {
  const { workspaceId } = await fixtures.createWorkspaceOwnedBy(userId, name)
  const checking = await accountIn(workspaceId, 'checking', 'Conta X')
  const housing = await accountIn(workspaceId, 'expense_category', 'Moradia')
  const groceries = await accountIn(workspaceId, 'expense_category', 'Mercado')
  await createRecurrenceRule(
    databases.app,
    { workspaceId, userId },
    {
      description: 'Aluguel',
      entryType: 'expense',
      amountCents: 200_000,
      sourceAccountId: checking,
      categoryAccountId: housing,
      schedule: { frequency: 'monthly', dayOfMonth: 13, startsOn: '2026-10-13' },
    },
    FIRST_OF_OCTOBER,
  )
  const pay = async (amountCents: number, categoryId = housing, occurredOn = '2026-10-12') => {
    const { entryId } = await recordEntry(
      databases.app,
      { workspaceId, userId, source: 'web' },
      {
        entryType: 'expense',
        occurredOn,
        description: 'Pagamento',
        amountCents,
        paidFromAccountId: checking,
        categoryId,
      },
      FIRST_OF_OCTOBER,
    )
    return entryId
  }
  const october = async () =>
    listOccurrences(databases.app, workspaceId, OCTOBER, FIRST_OF_OCTOBER).then(([first]) => first)
  return { workspaceId, groceries, pay, october }
}

function suggestionsFor(workspaceId: string, entryId: string) {
  return suggestOccurrencesForEntry(databases.app, workspaceId, entryId, FIRST_OF_OCTOBER)
}

describe('suggestOccurrencesForEntry', () => {
  it('suggests the planned rent for a payment that looks like it, and nothing else', async () => {
    const { workspaceId, groceries, pay, october } = await household('Suggestions')
    const rentPaid = await pay(204_000)
    const planned = await october()

    expect(await suggestionsFor(workspaceId, rentPaid)).toEqual([planned])
    expect(await suggestionsFor(workspaceId, await pay(211_000))).toEqual([])
    expect(await suggestionsFor(workspaceId, await pay(200_000, groceries))).toEqual([])
  })

  it('stops suggesting an occurrence once it is matched', async () => {
    const { workspaceId, pay, october } = await household('Matched stops')
    const first = await pay(200_000)
    const planned = await october()
    await matchOccurrence(databases.app, { workspaceId, occurrenceId: planned?.id ?? '' }, first)
    expect(await suggestionsFor(workspaceId, await pay(200_000))).toEqual([])
  })
})

describe('matchOccurrence and unmatchOccurrence', () => {
  it('link a confirmed payment to the occurrence and undo it', async () => {
    const { workspaceId, pay, october } = await household('Match')
    const entryId = await pay(200_000)
    const occurrenceId = (await october())?.id ?? ''

    await matchOccurrence(databases.app, { workspaceId, occurrenceId }, entryId)
    expect(await october()).toMatchObject({ status: 'matched', matchedEntryId: entryId })

    await unmatchOccurrence(databases.app, { workspaceId, occurrenceId })
    expect(await october()).toMatchObject({ status: 'pending', matchedEntryId: null })
  })

  it('refuse an entry of other accounts, a missing entry, a second match and a double use', async () => {
    const { workspaceId, groceries, pay, october } = await household('Refusals')
    const occurrenceId = (await october())?.id ?? ''
    const ref = { workspaceId, occurrenceId }

    await expect(
      matchOccurrence(databases.app, ref, await pay(200_000, groceries)),
    ).rejects.toMatchObject({
      code: 'OCCURRENCE_ENTRY_MISMATCH',
    })
    await expect(matchOccurrence(databases.app, ref, crypto.randomUUID())).rejects.toMatchObject({
      code: 'ENTRY_NOT_AVAILABLE',
    })
    await expect(unmatchOccurrence(databases.app, ref)).rejects.toMatchObject({
      code: 'OCCURRENCE_NOT_MATCHED',
    })

    const entryId = await pay(200_000)
    await matchOccurrence(databases.app, ref, entryId)
    await expect(matchOccurrence(databases.app, ref, await pay(200_000))).rejects.toMatchObject({
      code: 'OCCURRENCE_NOT_PENDING',
    })

    const [, november] = await listOccurrences(
      databases.app,
      workspaceId,
      { from: '2026-10-01', to: '2026-11-30' },
      FIRST_OF_OCTOBER,
    )
    await expect(
      matchOccurrence(databases.app, { workspaceId, occurrenceId: november?.id ?? '' }, entryId),
    ).rejects.toMatchObject({ code: 'ENTRY_ALREADY_MATCHED' })
  })
})
