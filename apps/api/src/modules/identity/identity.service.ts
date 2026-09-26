import { systemClock } from '@api/core/clock'
import type { Database } from '@api/core/db/client'
import {
  POSTGRES_UNIQUE_VIOLATION,
  postgresConstraintName,
  postgresErrorCode,
} from '@api/core/db/errors'
import {
  ConflictError,
  ForbiddenError,
  parseOrThrow,
  UnauthorizedError,
} from '@api/core/http/errors'
import {
  hashPassword,
  OWASP_PASSWORD_COST,
  passwordNeedsRehash,
  verifyPassword,
} from '@api/core/security/passwords'
import { generateToken, hashToken } from '@api/core/security/tokens'
import {
  deleteSession,
  deleteSessionByTokenHash,
  findLoginCandidate,
  findSessionByTokenHash,
  insertSession,
  insertUser,
  renewSession,
  updatePasswordHash,
} from '@api/modules/identity/identity.repository'
import type {
  ActiveSession,
  IdentityDeps,
  LoginInput,
  NewUserInput,
  StartedSession,
} from '@api/modules/identity/identity.types'
import { credentialsSchema, newUserSchema } from '@financas/shared'

const MS_PER_HOUR = 60 * 60 * 1000
const SESSION_LIFETIME_MS = 30 * 24 * MS_PER_HOUR
const SESSION_RENEWAL_INTERVAL_MS = MS_PER_HOUR
const USER_AGENT_MAX_LENGTH = 512
const USER_EMAIL_CONSTRAINT = 'users_email_unique'

const DEFAULT_DEPS: IdentityDeps = {
  clock: systemClock,
  passwordCost: OWASP_PASSWORD_COST,
}

export async function createUser(
  db: Database,
  input: NewUserInput,
  deps: Partial<IdentityDeps> = {},
): Promise<string> {
  const { clock, passwordCost } = { ...DEFAULT_DEPS, ...deps }
  const user = parseOrThrow(newUserSchema, input, 'USER_INVALID')
  const passwordHash = await hashPassword(user.password, passwordCost)

  return refusingTakenEmail(() =>
    insertUser(db, {
      email: user.email,
      displayName: user.displayName,
      passwordHash,
      emailVerifiedAt: input.isEmailVerified ? clock.now() : null,
    }),
  )
}

export async function login(
  db: Database,
  input: LoginInput,
  deps: Partial<IdentityDeps> = {},
): Promise<StartedSession> {
  const { clock, passwordCost } = { ...DEFAULT_DEPS, ...deps }
  const credentials = credentialsSchema.safeParse(input)
  if (!credentials.success) {
    throw invalidCredentials()
  }

  const { email, password } = credentials.data
  const user = await findLoginCandidate(db, email)
  const storedHash = user?.passwordHash ?? null
  const isPasswordRight = await verifyPassword(password, storedHash)
  if (!user || storedHash === null || !isPasswordRight || user.disabledAt) {
    throw invalidCredentials()
  }
  if (!user.emailVerifiedAt) {
    throw new ForbiddenError('EMAIL_NOT_VERIFIED', 'The email address is not verified yet')
  }

  if (passwordNeedsRehash(storedHash, passwordCost)) {
    await updatePasswordHash(db, user.id, await hashPassword(password, passwordCost))
  }
  return startSession(db, user.id, input.userAgent, clock.now())
}

export async function resolveSession(
  db: Database,
  token: string,
  deps: Partial<IdentityDeps> = {},
): Promise<ActiveSession | null> {
  const { clock } = { ...DEFAULT_DEPS, ...deps }
  const session = await findSessionByTokenHash(db, hashToken(token))
  if (!session) {
    return null
  }

  const now = clock.now()
  const isUsable = session.expiresAt > now && !session.userDisabledAt
  if (!isUsable) {
    await deleteSession(db, session.sessionId)
    return null
  }

  const active = { sessionId: session.sessionId, userId: session.userId }
  const isDueForRenewal =
    now.getTime() - session.lastSeenAt.getTime() >= SESSION_RENEWAL_INTERVAL_MS
  if (!isDueForRenewal) {
    return { ...active, expiresAt: session.expiresAt, isRenewed: false }
  }

  const expiresAt = sessionExpiryFrom(now)
  await renewSession(db, session.sessionId, now, expiresAt)
  return { ...active, expiresAt, isRenewed: true }
}

export async function logout(db: Database, token: string): Promise<void> {
  await deleteSessionByTokenHash(db, hashToken(token))
}

async function startSession(
  db: Database,
  userId: string,
  userAgent: string | undefined,
  now: Date,
): Promise<StartedSession> {
  const token = generateToken()
  const expiresAt = sessionExpiryFrom(now)
  await insertSession(db, {
    userId,
    tokenHash: hashToken(token),
    userAgent: userAgent?.slice(0, USER_AGENT_MAX_LENGTH) ?? null,
    createdAt: now,
    expiresAt,
  })
  return { userId, token, expiresAt }
}

function sessionExpiryFrom(now: Date): Date {
  return new Date(now.getTime() + SESSION_LIFETIME_MS)
}

function invalidCredentials(): UnauthorizedError {
  return new UnauthorizedError('INVALID_CREDENTIALS', 'Email or password is wrong')
}

async function refusingTakenEmail<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work()
  } catch (error) {
    const isTakenEmail =
      postgresErrorCode(error) === POSTGRES_UNIQUE_VIOLATION &&
      postgresConstraintName(error) === USER_EMAIL_CONSTRAINT
    if (isTakenEmail) {
      throw new ConflictError('EMAIL_TAKEN', 'Another user has this email', { cause: error })
    }
    throw error
  }
}
