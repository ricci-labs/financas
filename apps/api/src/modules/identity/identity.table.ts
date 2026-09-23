import { primaryId, timestamps } from '@api/core/db/columns'
import { sql } from 'drizzle-orm'
import {
  check,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export const notificationChannel = pgEnum('notification_channel', ['whatsapp', 'email'])

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

export const userPreferences = pgTable(
  'user_preferences',
  {
    userId: uuid()
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    language: text().notNull().default('pt-BR'),
    quietHoursStart: time(),
    quietHoursEnd: time(),
    ...timestamps(),
  },
  (table) => [
    check('user_preferences_language', sql`${table.language} ~ '^[a-z]{2}(-[A-Z]{2})?$'`),
    check(
      'user_preferences_quiet_hours_pair',
      sql`(${table.quietHoursStart} is null) = (${table.quietHoursEnd} is null)`,
    ),
  ],
)
