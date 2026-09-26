import {
  displayNameSchema,
  emailSchema,
  linkTokenSchema,
  passwordSchema,
} from '@shared/identity/identity.schemas'
import { z } from 'zod'

export const phoneE164Schema = z.string().regex(/^\+[1-9]\d{7,14}$/, 'Use the +55... format')

export const invitationRequestSchema = z.union([
  z.object({ email: emailSchema, roleId: z.uuid() }).strict(),
  z.object({ phoneE164: phoneE164Schema, roleId: z.uuid() }).strict(),
])

export const invitationParamsSchema = z.object({ invitationId: z.uuid() })

export const invitationTokenRequestSchema = z.object({ token: linkTokenSchema })

export type InvitationRequest = z.infer<typeof invitationRequestSchema>
export const invitationSignUpRequestSchema = z.object({
  token: linkTokenSchema,
  displayName: displayNameSchema,
  password: passwordSchema,
  email: emailSchema.optional(),
})

export type InvitationParams = z.infer<typeof invitationParamsSchema>
export type InvitationTokenRequest = z.infer<typeof invitationTokenRequestSchema>
export type InvitationSignUpRequest = z.infer<typeof invitationSignUpRequestSchema>
