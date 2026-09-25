import { sql } from 'drizzle-orm'
import { type AnyPgColumn, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const primaryId = () => uuid().primaryKey().default(sql`uuidv7()`)

export const timestamps = () => ({
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export const softDelete = (userIdColumn: () => AnyPgColumn) => ({
  deletedAt: timestamp({ withTimezone: true }),
  deletedByUserId: uuid().references(userIdColumn),
  deleteReason: text(),
})
