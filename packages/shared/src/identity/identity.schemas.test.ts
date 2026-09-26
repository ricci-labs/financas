import {
  credentialsSchema,
  emailSchema,
  newUserSchema,
  PASSWORD_MAX_LENGTH,
  passwordSchema,
} from '@shared/identity/identity.schemas'
import { describe, expect, it } from 'vitest'

describe('emailSchema', () => {
  it('trims and lowercases the address', () => {
    expect(emailSchema.parse('  Member.A@Example.COM ')).toBe('member.a@example.com')
  })

  it('refuses something that is not an address', () => {
    expect(emailSchema.safeParse('member-a').success).toBe(false)
    expect(emailSchema.safeParse('').success).toBe(false)
  })

  it('refuses an address longer than 254 characters', () => {
    const tooLong = `${'a'.repeat(250)}@example.com`
    expect(emailSchema.safeParse(tooLong).success).toBe(false)
  })
})

describe('passwordSchema', () => {
  it('accepts 12 to 128 characters with no composition rules', () => {
    expect(passwordSchema.safeParse('only lowercase').success).toBe(true)
    expect(passwordSchema.safeParse('x'.repeat(PASSWORD_MAX_LENGTH)).success).toBe(true)
  })

  it('refuses fewer than 12 or more than 128 characters', () => {
    expect(passwordSchema.safeParse('elevenchars').success).toBe(false)
    expect(passwordSchema.safeParse('x'.repeat(PASSWORD_MAX_LENGTH + 1)).success).toBe(false)
  })

  it('keeps spaces, since they can be part of a passphrase', () => {
    expect(passwordSchema.parse('  with spaces  ')).toBe('  with spaces  ')
  })
})

describe('newUserSchema', () => {
  it('normalizes the email and the display name', () => {
    const user = newUserSchema.parse({
      email: 'Member.A@Example.com',
      displayName: '  Member A ',
      password: 'a long enough password',
    })
    expect(user).toEqual({
      email: 'member.a@example.com',
      displayName: 'Member A',
      password: 'a long enough password',
    })
  })
})

describe('credentialsSchema', () => {
  it('accepts any non-empty password up to the maximum, so old passwords still log in', () => {
    expect(credentialsSchema.safeParse({ email: 'a@example.com', password: 'short' }).success).toBe(
      true,
    )
  })

  it('refuses a password above the maximum before any hashing', () => {
    const tooLong = { email: 'a@example.com', password: 'x'.repeat(PASSWORD_MAX_LENGTH + 1) }
    expect(credentialsSchema.safeParse(tooLong).success).toBe(false)
  })
})
