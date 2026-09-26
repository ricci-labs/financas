import type { Database } from '@api/core/db/client'
import { sessions, users } from '@api/modules/identity/identity.table'
import { eq, sql } from 'drizzle-orm'

type UserRow = {
  email: string
  displayName: string
  passwordHash: string
  emailVerifiedAt: Date | null
}

type SessionRow = {
  userId: string
  tokenHash: string
  userAgent: string | null
  createdAt: Date
  expiresAt: Date
}

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
