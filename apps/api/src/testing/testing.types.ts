import type { createApp } from '@api/app'
import type { Mailer } from '@api/core/email/email.types'
import type { AccountEmailLimits } from '@api/modules/identity'
import type { cardInvoices, journalEntries, ledgerAccounts } from '@api/modules/ledger/ledger.table'
import type { invitations } from '@api/modules/members/members.table'
import type { workspaceSettings } from '@api/modules/workspaces/workspaces.table'
import type { AccountKind } from '@financas/shared'

export type SetupOptions = {
  isPublicSignupEnabled?: boolean
  mailer?: Mailer
  accountEmailLimits?: AccountEmailLimits
}

export type NewAccount = Partial<typeof ledgerAccounts.$inferInsert> & { kind: AccountKind }

export type NewEntry = Partial<typeof journalEntries.$inferInsert>

export type PostingLine = {
  accountId: string
  kind: AccountKind
  amountCents: number
  lineNo?: number
  invoiceId?: string
}

export type NewInvoice = Partial<typeof cardInvoices.$inferInsert>

export type InvitationValues = Partial<typeof invitations.$inferInsert>

export type SettingsChange = Partial<typeof workspaceSettings.$inferInsert>

export type TestApp = ReturnType<typeof createApp>

export type TestSession = {
  userId: string
  cookie: string
}

export type SessionRequests = {
  get: (path: string) => Promise<Response>
  post: (path: string, body?: unknown) => Promise<Response>
  patch: (path: string, body: unknown) => Promise<Response>
  del: (path: string, body?: unknown) => Promise<Response>
}
