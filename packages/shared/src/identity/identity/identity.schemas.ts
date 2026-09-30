import { z } from 'zod'

export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_LENGTH = 128
export const EMAIL_MAX_LENGTH = 254
export const DISPLAY_NAME_MAX_LENGTH = 80
export const LINK_TOKEN_MAX_LENGTH = 128

export const emailSchema = z.string().trim().toLowerCase().max(EMAIL_MAX_LENGTH).pipe(z.email())

export const passwordSchema = z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH)

export const displayNameSchema = z.string().trim().min(1).max(DISPLAY_NAME_MAX_LENGTH)

export const newUserSchema = z.object({
  email: emailSchema,
  displayName: displayNameSchema,
  password: passwordSchema,
})

export const credentialsSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
})

export const loginRequestSchema = z.object({
  email: z.string().max(EMAIL_MAX_LENGTH),
  password: z.string().max(PASSWORD_MAX_LENGTH),
})

export const emailRequestSchema = z.object({ email: emailSchema })

export const linkTokenSchema = z.string().min(1).max(LINK_TOKEN_MAX_LENGTH)

export const verifyEmailRequestSchema = z.object({ token: linkTokenSchema })

export const resetPasswordRequestSchema = z.object({
  token: linkTokenSchema,
  password: z.string().max(PASSWORD_MAX_LENGTH),
})

const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/
const LANGUAGE_TAG = /^[a-z]{2}(-[A-Z]{2})?$/

export const passwordChangeRequestSchema = z.object({
  currentPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  newPassword: passwordSchema,
})

export const profileChangeSchema = z.object({ displayName: displayNameSchema })

const timeOfDaySchema = z.string().regex(TIME_OF_DAY, 'Use HH:MM')

export const userPreferencesChangeSchema = z
  .object({
    language: z.string().regex(LANGUAGE_TAG).optional(),
    quietHoursStart: timeOfDaySchema.nullable().optional(),
    quietHoursEnd: timeOfDaySchema.nullable().optional(),
  })
  .strict()
  .refine((change) => Object.values(change).some((value) => value !== undefined), {
    message: 'Nothing to change',
  })
  .refine(
    (change) =>
      (change.quietHoursStart === undefined) === (change.quietHoursEnd === undefined) &&
      (change.quietHoursStart === null) === (change.quietHoursEnd === null),
    { message: 'Quiet hours start and end go together', path: ['quietHoursEnd'] },
  )

export type NewUserFields = z.infer<typeof newUserSchema>
export type Credentials = z.infer<typeof credentialsSchema>
export type LoginRequest = z.infer<typeof loginRequestSchema>
export type EmailRequest = z.infer<typeof emailRequestSchema>
export type VerifyEmailRequest = z.infer<typeof verifyEmailRequestSchema>
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>
export type PasswordChangeRequest = z.infer<typeof passwordChangeRequestSchema>
export type ProfileChange = z.infer<typeof profileChangeSchema>
export type UserPreferencesChange = z.infer<typeof userPreferencesChangeSchema>
