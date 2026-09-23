import { primaryId, timestamps } from '@api/core/db/columns'
import { sql } from 'drizzle-orm'
import { pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

export const users = pgTable(
  'users',
  {
    id: primaryId(),
    email: text().notNull(),
    displayName: text().notNull(),
    passwordHash: text(),
    emailVerifiedAt: timestamp({ withTimezone: true }),
    disabledAt: timestamp({ withTimezone: true }),
    ...timestamps(),
  },
  (table) => [uniqueIndex('users_email_unique').on(sql`lower(${table.email})`)],
)
