import { primaryId, timestamps } from '@api/core/db/columns'
import { sql } from 'drizzle-orm'
import {
  check,
  index,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export const notificationChannel = pgEnum('notification_channel', ['whatsapp', 'email'])

export const authTokenPurpose = pgEnum('auth_token_purpose', [
  'email_verification',
  'password_reset',
])

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

export const sessions = pgTable(
  'sessions',
  {
    id: primaryId(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    lastSeenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    userAgent: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('sessions_token_hash_unique').on(table.tokenHash),
    index('sessions_user_id_index').on(table.userId),
    check('sessions_expire_after_creation', sql`${table.expiresAt} > ${table.createdAt}`),
  ],
)

export const authTokens = pgTable(
  'auth_tokens',
  {
    id: primaryId(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    purpose: authTokenPurpose().notNull(),
    tokenHash: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    usedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('auth_tokens_token_hash_unique').on(table.tokenHash),
    index('auth_tokens_user_purpose_index').on(table.userId, table.purpose),
    check('auth_tokens_expire_after_creation', sql`${table.expiresAt} > ${table.createdAt}`),
  ],
)
