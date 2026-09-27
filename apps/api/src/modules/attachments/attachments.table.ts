import { primaryId, softDelete, timestamps } from '@api/core/db/columns'
import { tenantIsolation } from '@api/core/db/tenancy'
import { charges } from '@api/modules/contacts/contacts.table'
import { users } from '@api/modules/identity/identity.table'
import { journalEntries } from '@api/modules/ledger/ledger.table'
import { workspaces } from '@api/modules/workspaces/workspaces.table'
import {
  ATTACHMENT_MIME_TYPES,
  ATTACHMENT_NAME_MAX_LENGTH,
  type AttachmentMimeType,
  FILE_SOURCES,
} from '@financas/shared'
import { sql } from 'drizzle-orm'
import {
  check,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

const limit = (value: number) => sql.raw(String(value))
const mimeTypeList = sql.raw(ATTACHMENT_MIME_TYPES.map((mimeType) => `'${mimeType}'`).join(', '))

export const fileSource = pgEnum('file_source', FILE_SOURCES)

export const files = pgTable(
  'files',
  {
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    id: primaryId(),
    storageKey: text().notNull(),
    mimeType: text().$type<AttachmentMimeType>().notNull(),
    sizeBytes: integer().notNull(),
    sha256: text().notNull(),
    originalName: text().notNull(),
    uploadedByUserId: uuid()
      .notNull()
      .references(() => users.id),
    source: fileSource().notNull(),
    ...softDelete(() => users.id),
    ...timestamps(),
  },
  (table) => [
    unique('files_workspace_id_id_unique').on(table.workspaceId, table.id),
    unique('files_workspace_id_sha256_unique').on(table.workspaceId, table.sha256),
    check('files_sha256', sql`${table.sha256} ~ '^[0-9a-f]{64}$'`),
    check(
      'files_storage_key',
      sql`${table.storageKey} = ${table.workspaceId}::text || '/' || ${table.sha256}`,
    ),
    check('files_mime_type', sql`${table.mimeType} in (${mimeTypeList})`),
    check('files_size', sql`${table.sizeBytes} > 0`),
    check(
      'files_original_name',
      sql`length(${table.originalName}) between 1 and ${limit(ATTACHMENT_NAME_MAX_LENGTH)}`,
    ),
    tenantIsolation('files', table.workspaceId),
  ],
).enableRLS()

export const entryAttachments = pgTable(
  'entry_attachments',
  {
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    entryId: uuid().notNull(),
    fileId: uuid().notNull(),
    attachedByUserId: uuid()
      .notNull()
      .references(() => users.id),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      name: 'entry_attachments_pk',
      columns: [table.workspaceId, table.entryId, table.fileId],
    }),
    foreignKey({
      name: 'entry_attachments_entry_fk',
      columns: [table.workspaceId, table.entryId],
      foreignColumns: [journalEntries.workspaceId, journalEntries.id],
    }),
    foreignKey({
      name: 'entry_attachments_file_fk',
      columns: [table.workspaceId, table.fileId],
      foreignColumns: [files.workspaceId, files.id],
    }),
    index('entry_attachments_file_idx').on(table.workspaceId, table.fileId),
    tenantIsolation('entry_attachments', table.workspaceId),
  ],
).enableRLS()

export const chargeAttachments = pgTable(
  'charge_attachments',
  {
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    chargeId: uuid().notNull(),
    fileId: uuid().notNull(),
    attachedByUserId: uuid()
      .notNull()
      .references(() => users.id),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      name: 'charge_attachments_pk',
      columns: [table.workspaceId, table.chargeId, table.fileId],
    }),
    foreignKey({
      name: 'charge_attachments_charge_fk',
      columns: [table.workspaceId, table.chargeId],
      foreignColumns: [charges.workspaceId, charges.id],
    }),
    foreignKey({
      name: 'charge_attachments_file_fk',
      columns: [table.workspaceId, table.fileId],
      foreignColumns: [files.workspaceId, files.id],
    }),
    index('charge_attachments_file_idx').on(table.workspaceId, table.fileId),
    tenantIsolation('charge_attachments', table.workspaceId),
  ],
).enableRLS()
