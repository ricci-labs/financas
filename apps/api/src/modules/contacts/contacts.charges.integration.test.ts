import { createApp } from '@api/app'
import {
  type ChargeView,
  cancelCharge,
  createCharge,
  createContact,
  listCharges,
  markChargeSent,
  payCharge,
} from '@api/modules/contacts'
import { createAccount, createCard, deleteEntry, recordEntry } from '@api/modules/ledger'
import { setPixReceiving } from '@api/modules/workspaces'
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
  const userId = await fixtures.createUser(`charges-${crypto.randomUUID().slice(0, 8)}`)
  const { workspaceId } = await fixtures.createWorkspaceOwnedBy(userId, 'Charges')
  const context = { workspaceId, userId }
  const checking = (
    await createAccount(databases.app, context, { kind: 'checking', name: 'Conta X' })
  ).accountId
  const fun = (
    await createAccount(databases.app, context, { kind: 'expense_category', name: 'Lazer' })
  ).accountId
  const card = (
    await createCard(databases.app, context, { name: 'Card X', closingDay: 3, dueDay: 10 })
  ).accountId
  const { contactId } = await createContact(databases.app, context, { name: 'Contact J' })
  const entry = (input: Record<string, unknown>) =>
    recordEntry(databases.app, { ...context, source: 'web' }, input, MID_OCTOBER)
  await entry({
    entryType: 'card_purchase',
    occurredOn: '2026-10-05',
    description: 'TV',
    amountCents: 120_000,
    installmentCount: 3,
    cardAccountId: card,
    categoryId: fun,
    shares: [{ contactId, amountCents: 30_000 }],
  })
  await entry({
    entryType: 'expense',
    occurredOn: '2026-10-06',
    description: 'Jantar',
    amountCents: 15_000,
    paidFromAccountId: checking,
    categoryId: fun,
    shares: [{ contactId, amountCents: 5_000 }],
  })
  await entry({
    entryType: 'settlement',
    occurredOn: '2026-10-07',
    description: 'Pix',
    amountCents: 2_000,
    contactId,
    receivedInAccountId: checking,
  })
  const ref = { workspaceId, contactId }
  const charge = (until?: string) =>
    createCharge(databases.app, ref, userId, until ? { until } : {}, MID_OCTOBER)
  const charges = () => listCharges(databases.app, workspaceId, contactId)
  return { workspaceId, userId, contactId, checking, charge, charges }
}

function byId(charges: ChargeView[], chargeId: string): ChargeView | undefined {
  return charges.find((charge) => charge.id === chargeId)
}

describe('createCharge', () => {
  it('charges what is open up to today, the oldest paid first, with a pt-BR message', async () => {
    const { charge, charges } = await household()
    const { chargeId } = await charge()
    const created = byId(await charges(), chargeId)
    expect(created).toMatchObject({
      amountCents: 3_000,
      dueOn: '2026-10-06',
      status: 'draft',
      pixPayload: null,
    })
    expect(created?.items).toHaveLength(1)
    expect(created?.messageText).toContain('Oi, Contact J!')
    expect(created?.messageText).toContain('• Jantar — R$ 30,00')
  })

  it('leaves items already charged out of the next charge, and carries the Pix when set', async () => {
    const { workspaceId, charge, charges } = await household()
    await charge()
    await setPixReceiving(databases.app, workspaceId, {
      key: 'household@example.test',
      receiverName: 'Casa',
      receiverCity: 'Sao Paulo',
    })
    const { chargeId } = await charge('2026-11-30')
    const next = byId(await charges(), chargeId)
    expect(next).toMatchObject({ amountCents: 10_000, dueOn: '2026-11-10' })
    expect(next?.messageText).toContain('• TV (parcela 1/3) — R$ 100,00')
    expect(next?.pixPayload).toContain('br.gov.bcb.pix')
    expect(next?.messageText).toContain(next?.pixPayload ?? 'missing')
  })

  it('charges an item again once its charge is cancelled, and refuses when nothing is open', async () => {
    const { workspaceId, charge, charges } = await household()
    const { chargeId } = await charge()
    await expect(charge()).rejects.toMatchObject({ code: 'NOTHING_TO_CHARGE' })
    await cancelCharge(databases.app, { workspaceId, chargeId })
    const again = await charge()
    expect(byId(await charges(), again.chargeId)?.amountCents).toBe(3_000)
  })
})

describe('charge status', () => {
  it('goes from draft to sent, and can be cancelled while open, not twice', async () => {
    const { workspaceId, charge, charges } = await household()
    const { chargeId } = await charge()
    const ref = { workspaceId, chargeId }
    await markChargeSent(databases.app, ref, MID_OCTOBER)
    expect(byId(await charges(), chargeId)).toMatchObject({ status: 'sent' })
    await expect(markChargeSent(databases.app, ref)).rejects.toMatchObject({
      code: 'CHARGE_STATUS_REFUSED',
    })
    await cancelCharge(databases.app, ref)
    await expect(cancelCharge(databases.app, ref)).rejects.toMatchObject({
      code: 'CHARGE_STATUS_REFUSED',
    })
  })
})

describe('payCharge', () => {
  it('records settlements against a charge, which becomes partially paid, then paid', async () => {
    const { workspaceId, userId, checking, charge, charges } = await household()
    const { chargeId } = await charge()
    const ref = { workspaceId, chargeId }
    const pay = (amountCents: number) =>
      payCharge(
        databases.app,
        ref,
        userId,
        { amountCents, receivedInAccountId: checking, occurredOn: '2026-10-16' },
        MID_OCTOBER,
      )

    await pay(1_000)
    expect(byId(await charges(), chargeId)).toMatchObject({
      status: 'partially_paid',
      paidCents: 1_000,
    })
    await expect(cancelCharge(databases.app, ref)).rejects.toMatchObject({
      code: 'CHARGE_STATUS_REFUSED',
    })
    const { entryId } = await pay(2_000)
    expect(byId(await charges(), chargeId)).toMatchObject({ status: 'paid', paidCents: 3_000 })

    await deleteEntry(databases.app, { workspaceId, entryId, userId })
    expect(byId(await charges(), chargeId)).toMatchObject({
      status: 'partially_paid',
      paidCents: 1_000,
    })
  })

  it('refuses paying a cancelled charge', async () => {
    const { workspaceId, userId, checking, charge } = await household()
    const { chargeId } = await charge()
    await cancelCharge(databases.app, { workspaceId, chargeId })
    await expect(
      payCharge(
        databases.app,
        { workspaceId, chargeId },
        userId,
        { amountCents: 1_000, receivedInAccountId: checking, occurredOn: '2026-10-16' },
        MID_OCTOBER,
      ),
    ).rejects.toMatchObject({ code: 'CHARGE_STATUS_REFUSED' })
  })
})

describe('charges over HTTP', () => {
  it('let contacts:create charge and contacts:update send or cancel; viewers only read', async () => {
    const app = createApp(testAppDeps({ db: databases.app }))
    const ownerSession = await loggedInUser(app, databases.app, fixtures.runId, 'charges-owner')
    const viewerSession = await loggedInUser(app, databases.app, fixtures.runId, 'charges-viewer')
    const { workspaceId } = await fixtures.createWorkspaceOwnedBy(
      ownerSession.userId,
      'Charges HTTP',
    )
    await addMemberWithSystemRole(
      databases.app,
      databases.owner,
      workspaceId,
      viewerSession.userId,
      'viewer',
    )
    const owner = requestsAs(app, ownerSession)
    const viewer = requestsAs(app, viewerSession)
    const base = `/api/workspaces/${workspaceId}`
    const contact = await owner.post(`${base}/contacts`, { name: 'Contact Z' })
    const { contactId } = (await contact.json()) as { contactId: string }

    expect((await viewer.post(`${base}/contacts/${contactId}/charges`, {})).status).toBe(403)
    const empty = await owner.post(`${base}/contacts/${contactId}/charges`, {})
    expect(empty.status).toBe(409)
    expect((await viewer.get(`${base}/charges?contactId=${contactId}`)).status).toBe(200)
    expect((await owner.post(`${base}/charges/not-a-uuid/cancel`)).status).toBe(404)
    expect((await viewer.post(`${base}/charges/${crypto.randomUUID()}/sent`)).status).toBe(403)
  })
})

describe('GET /charges/:chargeId', () => {
  it('shows one charge as the list does, only inside its workspace', async () => {
    const app = createApp(testAppDeps({ db: databases.app }))
    const { workspaceId, charge, charges } = await household()
    const { chargeId } = await charge()
    const viewerSession = await loggedInUser(app, databases.app, fixtures.runId, 'charge-reader')
    await addMemberWithSystemRole(
      databases.app,
      databases.owner,
      workspaceId,
      viewerSession.userId,
      'viewer',
    )
    const viewer = requestsAs(app, viewerSession)
    const listed = byId(await charges(), chargeId)

    const response = await viewer.get(`/api/workspaces/${workspaceId}/charges/${chargeId}`)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(JSON.parse(JSON.stringify(listed)))

    const other = await household()
    const { chargeId: foreignChargeId } = await other.charge()
    for (const id of [foreignChargeId, crypto.randomUUID(), 'not-a-uuid']) {
      const missing = await viewer.get(`/api/workspaces/${workspaceId}/charges/${id}`)
      expect(missing.status).toBe(404)
      expect(await missing.json()).toMatchObject({ error: { code: 'CHARGE_NOT_FOUND' } })
    }
  })
})
