import { z } from 'zod'

export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_LENGTH = 128
export const EMAIL_MAX_LENGTH = 254
export const DISPLAY_NAME_MAX_LENGTH = 80

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

export type NewUserFields = z.infer<typeof newUserSchema>
export type Credentials = z.infer<typeof credentialsSchema>
