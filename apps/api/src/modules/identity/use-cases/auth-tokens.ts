import type { Database } from '@api/core/db/db.types'
import { generateToken, hashToken } from '@api/core/security/tokens'
import { deleteOpenAuthTokens, insertAuthToken } from '@api/modules/identity/identity.repository'
import type { AuthTokenPurpose } from '@api/modules/identity/identity.types'

export async function issueAuthToken(
  db: Database,
  userId: string,
  purpose: AuthTokenPurpose,
  lifetimeMs: number,
  now: Date,
): Promise<string> {
  await deleteOpenAuthTokens(db, userId, purpose)
  const token = generateToken()
  await insertAuthToken(db, {
    userId,
    purpose,
    tokenHash: hashToken(token),
    createdAt: now,
    expiresAt: new Date(now.getTime() + lifetimeMs),
  })
  return token
}
