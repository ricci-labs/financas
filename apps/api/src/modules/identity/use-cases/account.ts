import type { Database } from '@api/core/db/db.types'
import { NotFoundError, parseOrThrow, ValidationError } from '@api/core/http/errors'
import { hashPassword, verifyPassword } from '@api/core/security/passwords'
import {
  deleteOtherSessions,
  findPasswordOwner,
  selectUserPreferences,
  updateDisplayName,
  updatePasswordHash,
  upsertUserPreferences,
} from '@api/modules/identity/identity.repository'
import type {
  EmailRecipient,
  IdentityDeps,
  PasswordChangeInput,
  UserPreferences,
} from '@api/modules/identity/identity.types'
import { withDefaults } from '@api/modules/identity/use-cases/defaults'
import { displayNameSchema, passwordSchema, userPreferencesChangeSchema } from '@financas/shared'

const DEFAULT_PREFERENCES: UserPreferences = {
  language: 'pt-BR',
  quietHoursStart: null,
  quietHoursEnd: null,
}
const HOURS_AND_MINUTES_LENGTH = 5

export async function changePassword(
  db: Database,
  { userId, sessionId, currentPassword, newPassword }: PasswordChangeInput,
  deps: Partial<IdentityDeps> = {},
): Promise<EmailRecipient> {
  const { passwordCost } = withDefaults(deps)
  const password = parseOrThrow(passwordSchema, newPassword, 'PASSWORD_INVALID')
  const owner = await findPasswordOwner(db, userId)
  if (!owner) {
    throw new NotFoundError('USER_NOT_FOUND', 'User not found')
  }
  if (!(await verifyPassword(currentPassword, owner.passwordHash))) {
    throw new ValidationError('CURRENT_PASSWORD_WRONG', 'The current password is wrong')
  }

  await updatePasswordHash(db, userId, await hashPassword(password, passwordCost))
  await deleteOtherSessions(db, userId, sessionId)
  return { userId, email: owner.email, displayName: owner.displayName }
}

export async function changeDisplayName(
  db: Database,
  userId: string,
  displayName: string,
): Promise<void> {
  const name = parseOrThrow(displayNameSchema, displayName, 'PROFILE_INVALID')
  await updateDisplayName(db, userId, name)
}

export async function getUserPreferences(db: Database, userId: string): Promise<UserPreferences> {
  const stored = await selectUserPreferences(db, userId)
  return stored ? withShortTimes(stored) : DEFAULT_PREFERENCES
}

export async function changeUserPreferences(
  db: Database,
  userId: string,
  rawChange: unknown,
): Promise<UserPreferences> {
  const change = parseOrThrow(userPreferencesChangeSchema, rawChange, 'PREFERENCES_INVALID')
  await upsertUserPreferences(db, userId, change)
  return getUserPreferences(db, userId)
}

function withShortTimes(preferences: UserPreferences): UserPreferences {
  return {
    language: preferences.language,
    quietHoursStart: preferences.quietHoursStart?.slice(0, HOURS_AND_MINUTES_LENGTH) ?? null,
    quietHoursEnd: preferences.quietHoursEnd?.slice(0, HOURS_AND_MINUTES_LENGTH) ?? null,
  }
}
