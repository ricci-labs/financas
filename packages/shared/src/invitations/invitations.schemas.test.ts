import { invitationRequestSchema } from '@shared/invitations/invitations.schemas'
import { describe, expect, it } from 'vitest'

const ROLE = '01a0d8ce-060b-7dd3-a56f-5995e1676b98'

describe('invitationRequestSchema', () => {
  it('accepts an email or a phone, normalizing the email', () => {
    expect(invitationRequestSchema.parse({ email: ' Guest@Example.TEST ', roleId: ROLE })).toEqual({
      email: 'guest@example.test',
      roleId: ROLE,
    })
    expect(invitationRequestSchema.parse({ phoneE164: '+5511999990000', roleId: ROLE })).toEqual({
      phoneE164: '+5511999990000',
      roleId: ROLE,
    })
  })

  it('refuses both contacts at once, none, a local phone number and a bad role id', () => {
    const invalid = [
      { email: 'guest@example.test', phoneE164: '+5511999990000', roleId: ROLE },
      { roleId: ROLE },
      { phoneE164: '11999990000', roleId: ROLE },
      { email: 'guest@example.test', roleId: 'owner' },
    ]
    for (const request of invalid) {
      expect(invitationRequestSchema.safeParse(request).success).toBe(false)
    }
  })
})
