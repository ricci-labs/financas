import { passwordSchema } from '@financas/shared'
import { authMessages } from '@web/features/auth/auth.messages'
import { z } from 'zod'

export const LOGIN_NOTICES = [
  'session-ended',
  'logged-out',
  'password-changed',
  'email-verified',
] as const

export const loginSearchSchema = z.object({
  next: z.string().optional().catch(undefined),
  notice: z.enum(LOGIN_NOTICES).optional().catch(undefined),
})

export const newPasswordSchema = z
  .object({ password: passwordSchema, confirmation: z.string().min(1) })
  .refine((fields) => fields.password === fields.confirmation, {
    path: ['confirmation'],
    error: authMessages.resetPassword.mismatch,
  })
