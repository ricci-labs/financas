import { systemClock } from '@api/core/clock'
import type { Clock } from '@api/core/clock.types'
import type { Database } from '@api/core/db/db.types'
import {
  deleteAuthTokensExpiredBy,
  deleteSessionsExpiredBy,
} from '@api/modules/identity/identity.repository'
import type { PurgedCredentials } from '@api/modules/identity/identity.types'

export async function purgeExpiredCredentials(
  db: Database,
  clock: Clock = systemClock,
): Promise<PurgedCredentials> {
  const now = clock.now()
  return {
    sessions: await deleteSessionsExpiredBy(db, now),
    authTokens: await deleteAuthTokensExpiredBy(db, now),
  }
}
