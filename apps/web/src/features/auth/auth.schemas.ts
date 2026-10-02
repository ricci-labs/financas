import { z } from 'zod'

export const LOGIN_NOTICES = [
  'session-ended',
  'logged-out',
  'password-changed',
  'email-verified',
  'invitation-account-created',
] as const

export const loginSearchSchema = z.object({
  next: z.string().optional().catch(undefined),
  notice: z.enum(LOGIN_NOTICES).optional().catch(undefined),
})
