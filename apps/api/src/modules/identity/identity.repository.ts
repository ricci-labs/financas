import type { Database } from '@api/core/db/db.types'
import { authTokens, sessions, userPreferences, users } from '@api/modules/identity/identity.table'
import type {
  AuthTokenPurpose,
  AuthTokenRow,
  SessionRow,
  UserPreferencesUpdate,
  UserRow,
} from '@api/modules/identity/identity.types'
import { and, eq, gt, inArray, isNull, ne, sql } from 'drizzle-orm'

export async function insertUser(db: Database, user: UserRow): Promise<string> {
  const [inserted] = await db.insert(users).values(user).returning({ id: users.id })
  if (!inserted) {
    throw new Error('User was not inserted')
  }
  return inserted.id
}

export async function findLoginCandidate(db: Database, email: string) {
  const [candidate] = await db
    .select({
      id: users.id,
      passwordHash: users.passwordHash,
      emailVerifiedAt: users.emailVerifiedAt,
      disabledAt: users.disabledAt,
    })
    .from(users)
    .where(eq(sql`lower(${users.email})`, email.toLowerCase()))
  return candidate
}

export async function updatePasswordHash(
  db: Database,
  userId: string,
  passwordHash: string,
): Promise<void> {
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId))
}

export async function insertSession(db: Database, session: SessionRow): Promise<void> {
  await db.insert(sessions).values({ ...session, lastSeenAt: session.createdAt })
}

export async function findSessionByTokenHash(db: Database, tokenHash: string) {
  const [session] = await db
    .select({
      sessionId: sessions.id,
      userId: sessions.userId,
      expiresAt: sessions.expiresAt,
      lastSeenAt: sessions.lastSeenAt,
      userDisabledAt: users.disabledAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.tokenHash, tokenHash))
  return session
}

export async function renewSession(
  db: Database,
  sessionId: string,
  lastSeenAt: Date,
  expiresAt: Date,
): Promise<void> {
  await db.update(sessions).set({ lastSeenAt, expiresAt }).where(eq(sessions.id, sessionId))
}

export async function deleteSession(db: Database, sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId))
}

export async function deleteSessionByTokenHash(db: Database, tokenHash: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash))
}

export async function findAccountByEmail(db: Database, email: string) {
  const [account] = await db
    .select({
      userId: users.id,
      email: users.email,
      displayName: users.displayName,
      emailVerifiedAt: users.emailVerifiedAt,
      disabledAt: users.disabledAt,
    })
    .from(users)
    .where(eq(sql`lower(${users.email})`, email.toLowerCase()))
  return account
}

export async function deleteOpenAuthTokens(
  db: Database,
  userId: string,
  purpose: AuthTokenPurpose,
): Promise<void> {
  await db
    .delete(authTokens)
    .where(
      and(
        eq(authTokens.userId, userId),
        eq(authTokens.purpose, purpose),
        isNull(authTokens.usedAt),
      ),
    )
}

export async function insertAuthToken(db: Database, token: AuthTokenRow): Promise<void> {
  await db.insert(authTokens).values(token)
}

export async function verifyEmailWithToken(
  db: Database,
  tokenHash: string,
  now: Date,
): Promise<string | undefined> {
  const result = await db.execute<{ id: string }>(sql`
    with used_token as (
      update auth_tokens set used_at = ${now}
      where token_hash = ${tokenHash}
        and purpose = 'email_verification'
        and used_at is null
        and expires_at > ${now}
      returning user_id
    )
    update users set email_verified_at = coalesce(email_verified_at, ${now})
    where id in (select user_id from used_token)
    returning id`)
  return result.rows[0]?.id
}

export async function resetPasswordWithToken(
  db: Database,
  tokenHash: string,
  passwordHash: string,
  now: Date,
) {
  const result = await db.execute<{ user_id: string; email: string; display_name: string }>(sql`
    with used_token as (
      update auth_tokens set used_at = ${now}
      where token_hash = ${tokenHash}
        and purpose = 'password_reset'
        and used_at is null
        and expires_at > ${now}
      returning user_id
    ),
    changed_user as (
      update users
      set password_hash = ${passwordHash},
          email_verified_at = coalesce(email_verified_at, ${now})
      where id in (select user_id from used_token)
        and disabled_at is null
      returning id, email, display_name
    ),
    ended_sessions as (
      delete from sessions where user_id in (select id from changed_user)
    )
    select id as user_id, email, display_name from changed_user`)
  const changed = result.rows[0]
  if (!changed) {
    return undefined
  }
  return { userId: changed.user_id, email: changed.email, displayName: changed.display_name }
}

export async function findAccountById(db: Database, userId: string) {
  const [account] = await db
    .select({ userId: users.id, email: users.email, displayName: users.displayName })
    .from(users)
    .where(eq(users.id, userId))
  return account
}

export async function isUsableAuthToken(
  db: Database,
  tokenHash: string,
  purpose: AuthTokenPurpose,
  now: Date,
): Promise<boolean> {
  const [usable] = await db
    .select({ id: authTokens.id })
    .from(authTokens)
    .innerJoin(users, eq(users.id, authTokens.userId))
    .where(
      and(
        eq(authTokens.tokenHash, tokenHash),
        eq(authTokens.purpose, purpose),
        isNull(authTokens.usedAt),
        gt(authTokens.expiresAt, now),
        isNull(users.disabledAt),
      ),
    )
  return usable !== undefined
}

export function selectAccountsByIds(db: Database, userIds: string[]) {
  return db
    .select({ userId: users.id, email: users.email, displayName: users.displayName })
    .from(users)
    .where(inArray(users.id, userIds))
}

export async function findPasswordOwner(db: Database, userId: string) {
  const [owner] = await db
    .select({
      userId: users.id,
      email: users.email,
      displayName: users.displayName,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.id, userId))
  return owner
}

export async function deleteOtherSessions(
  db: Database,
  userId: string,
  keptSessionId: string,
): Promise<void> {
  await db.delete(sessions).where(and(eq(sessions.userId, userId), ne(sessions.id, keptSessionId)))
}

export async function updateDisplayName(
  db: Database,
  userId: string,
  displayName: string,
): Promise<void> {
  await db.update(users).set({ displayName }).where(eq(users.id, userId))
}

export async function selectUserPreferences(db: Database, userId: string) {
  const [preferences] = await db
    .select({
      language: userPreferences.language,
      quietHoursStart: userPreferences.quietHoursStart,
      quietHoursEnd: userPreferences.quietHoursEnd,
    })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
  return preferences
}

export async function upsertUserPreferences(
  db: Database,
  userId: string,
  change: UserPreferencesUpdate,
): Promise<void> {
  await db
    .insert(userPreferences)
    .values({ userId, ...change })
    .onConflictDoUpdate({ target: userPreferences.userId, set: change })
}
