import { phoneE164Schema } from '@shared/identity/invitations/invitations.schemas'
import { z } from 'zod'

export const CONTACT_NAME_MAX_LENGTH = 80

export const CONTACT_NOTES_MAX_LENGTH = 500

export const PIX_KEY_MAX_LENGTH = 77

const contactFields = {
  name: z.string().trim().min(1).max(CONTACT_NAME_MAX_LENGTH),
  phoneE164: phoneE164Schema.nullable(),
  pixKey: z.string().trim().min(1).max(PIX_KEY_MAX_LENGTH).nullable(),
  notes: z.string().trim().max(CONTACT_NOTES_MAX_LENGTH).nullable(),
}

export const newContactSchema = z.strictObject({
  ...contactFields,
  phoneE164: contactFields.phoneE164.default(null),
  pixKey: contactFields.pixKey.default(null),
  notes: contactFields.notes.default(null),
})

export type NewContact = z.infer<typeof newContactSchema>

export const contactChangeSchema = z
  .strictObject({ ...contactFields, isOptedOut: z.boolean(), isArchived: z.boolean() })
  .partial()
  .refine((change) => Object.keys(change).length > 0, { message: 'Nothing to change' })

export type ContactChange = z.infer<typeof contactChangeSchema>

export const contactParamsSchema = z.object({ contactId: z.uuid() })
