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

export type NewUserFields = z.infer<typeof newUserSchema>
export type Credentials = z.infer<typeof credentialsSchema>
export type LoginRequest = z.infer<typeof loginRequestSchema>
export type EmailRequest = z.infer<typeof emailRequestSchema>
export type VerifyEmailRequest = z.infer<typeof verifyEmailRequestSchema>
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>
