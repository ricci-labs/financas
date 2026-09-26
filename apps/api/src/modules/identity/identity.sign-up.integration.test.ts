import type { Clock } from '@api/core/clock.types'
import type { PasswordCost } from '@api/core/security/security.types'
import { hashToken } from '@api/core/security/tokens'
import {
  createUser,
  login,
  requestEmailVerification,
  type SignUpDeps,
  signUp,
  verifyEmail,
} from '@api/modules/identity'
import { authTokens, users } from '@api/modules/identity/identity.table'
import { connectTestDatabases } from '@api/testing/database'
import { createFixtures } from '@api/testing/fixtures'
import { createRecordingMailer, tokenFromEmail } from '@api/testing/mailer'
import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'

const databases = connectTestDatabases()
const fixtures = createFixtures(databases.owner, databases.app)

const PASSWORD = 'a long enough password'
const FAST_COST: PasswordCost = { cpuMemoryCost: 2 ** 10, blockSize: 8, parallelization: 1 }
const PUBLIC_URL = 'https://financas.example.test'
const MS_PER_HOUR = 60 * 60 * 1000
const START = new Date('2026-10-01T12:00:00Z')

afterAll(async () => {
  await fixtures.removeEverything()
  await databases.closeAll()
})

function clockAt(date: Date): Clock {
  return { now: () => date }
}

function later(milliseconds: number): Date {
  return new Date(START.getTime() + milliseconds)
}

function emailFor(label: string): string {
  return `${label}-${crypto.randomUUID()}-${fixtures.runId}@example.test`
}

function setup(overrides: Partial<SignUpDeps> = {}) {
  const { mailer, sent } = createRecordingMailer()
  const deps: SignUpDeps = {
    mailer,
    publicUrl: PUBLIC_URL,
    isPublicSignupEnabled: true,
    clock: clockAt(START),
    passwordCost: FAST_COST,
    ...overrides,
  }
  return { deps, sent }
}

function signUpInput(label: string) {
  return { email: emailFor(label), displayName: `Member ${label}`, password: PASSWORD }
}

async function storedUserByEmail(email: string) {
  const [user] = await databases.owner.select().from(users).where(eq(users.email, email))
  return user
}

function loginAt(email: string, date: Date) {
  return login(
    databases.app,
    { email, password: PASSWORD },
    { clock: clockAt(date), passwordCost: FAST_COST },
  )
}

describe('signUp', () => {
  it('is refused while public sign-up is turned off, and creates nothing', async () => {
    const { deps, sent } = setup({ isPublicSignupEnabled: false })
    const input = signUpInput('switched-off')
    await expect(signUp(databases.app, input, deps)).rejects.toMatchObject({
      name: 'ForbiddenError',
      code: 'SIGNUP_DISABLED',
    })
    expect(await storedUserByEmail(input.email)).toBeUndefined()
    expect(sent).toEqual([])
  })

  it('creates an unverified user and emails a single-use link kept only as a hash', async () => {
    const { deps, sent } = setup()
    const input = signUpInput('new')
    await signUp(databases.app, input, deps)

    const user = await storedUserByEmail(input.email)
    expect(user?.emailVerifiedAt).toBeNull()
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ template: 'email_verification', to: input.email })
    expect(sent[0]?.text).toContain(`${PUBLIC_URL}/verify-email#token=`)

    const token = tokenFromEmail(sent[0])
    const [stored] = await databases.owner
      .select()
      .from(authTokens)
      .where(eq(authTokens.userId, user?.id ?? ''))
    expect(stored).toMatchObject({
      purpose: 'email_verification',
      tokenHash: hashToken(token),
      usedAt: null,
      expiresAt: later(24 * MS_PER_HOUR),
    })
  })

  it('lets the user log in only after the link is used', async () => {
    const { deps, sent } = setup()
    const input = signUpInput('verify')
    await signUp(databases.app, input, deps)

    await expect(loginAt(input.email, START)).rejects.toMatchObject({ code: 'EMAIL_NOT_VERIFIED' })
    await verifyEmail(databases.app, tokenFromEmail(sent[0]), {
      clock: clockAt(later(MS_PER_HOUR)),
    })
    await expect(loginAt(input.email, later(MS_PER_HOUR))).resolves.toHaveProperty('token')
  })

  it('never changes an existing account and warns its owner instead', async () => {
    const { deps, sent } = setup()
    const email = emailFor('existing')
    const userId = await createUser(
      databases.app,
      { email, displayName: 'Member Owner', password: PASSWORD, isEmailVerified: true },
      { passwordCost: FAST_COST },
    )
    const before = await storedUserByEmail(email)

    await signUp(
      databases.app,
      { email: email.toUpperCase(), displayName: 'Intruder', password: 'another long password' },
      deps,
    )

    expect(await storedUserByEmail(email)).toEqual(before)
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ template: 'account_already_exists', to: email })
    expect(sent[0]?.text).toContain('Member Owner')
    expect(sent[0]?.text).not.toContain('Intruder')
    expect(sent[0]?.text).toContain(`${PUBLIC_URL}/forgot-password`)
    expect(before?.id).toBe(userId)
  })

  it('refuses a short password before creating anything', async () => {
    const { deps, sent } = setup()
    const input = { ...signUpInput('short'), password: 'too short' }
    await expect(signUp(databases.app, input, deps)).rejects.toMatchObject({ code: 'USER_INVALID' })
    expect(await storedUserByEmail(input.email)).toBeUndefined()
    expect(sent).toEqual([])
  })

  it('escapes the display name in the HTML of the email', async () => {
    const { deps, sent } = setup()
    const input = { ...signUpInput('markup'), displayName: '<a href="https://evil.test">Win</a>' }
    await signUp(databases.app, input, deps)
    expect(sent[0]?.html).not.toContain('<a href="https://evil.test"')
    expect(sent[0]?.html).toContain('&lt;a href=&quot;https://evil.test&quot;&gt;')
  })
})

describe('verifyEmail', () => {
  async function signedUp(label: string) {
    const { deps, sent } = setup()
    const input = signUpInput(label)
    await signUp(databases.app, input, deps)
    return { email: input.email, token: tokenFromEmail(sent[0]) }
  }

  it('works once; the same link is refused afterwards', async () => {
    const { token } = await signedUp('once')
    await verifyEmail(databases.app, token, { clock: clockAt(START) })
    await expect(
      verifyEmail(databases.app, token, { clock: clockAt(START) }),
    ).rejects.toMatchObject({ code: 'LINK_INVALID' })
  })

  it('refuses a link older than 24 hours and leaves the email unverified', async () => {
    const { email, token } = await signedUp('late')
    await expect(
      verifyEmail(databases.app, token, { clock: clockAt(later(24 * MS_PER_HOUR)) }),
    ).rejects.toMatchObject({ code: 'LINK_INVALID' })
    expect((await storedUserByEmail(email))?.emailVerifiedAt).toBeNull()
  })

  it('refuses a link issued for another purpose', async () => {
    const { email } = await signedUp('other-purpose')
    const user = await storedUserByEmail(email)
    const resetToken = 'password-reset-token-for-this-test'
    await databases.owner.insert(authTokens).values({
      userId: user?.id ?? '',
      purpose: 'password_reset',
      tokenHash: hashToken(resetToken),
      createdAt: START,
      expiresAt: later(MS_PER_HOUR),
    })
    await expect(
      verifyEmail(databases.app, resetToken, { clock: clockAt(START) }),
    ).rejects.toMatchObject({ code: 'LINK_INVALID' })
    expect((await storedUserByEmail(email))?.emailVerifiedAt).toBeNull()
  })

  it('refuses a token that was never issued', async () => {
    await expect(
      verifyEmail(databases.app, 'made-up-token', { clock: clockAt(START) }),
    ).rejects.toMatchObject({ code: 'LINK_INVALID' })
  })
})

describe('requestEmailVerification', () => {
  it('sends a new link to an unverified user and retires the old one', async () => {
    const { deps, sent } = setup()
    const input = signUpInput('resend')
    await signUp(databases.app, input, deps)
    const oldToken = tokenFromEmail(sent[0])

    await requestEmailVerification(databases.app, { email: input.email }, deps)

    expect(sent).toHaveLength(2)
    await expect(
      verifyEmail(databases.app, oldToken, { clock: clockAt(START) }),
    ).rejects.toMatchObject({ code: 'LINK_INVALID' })
    await verifyEmail(databases.app, tokenFromEmail(sent[1]), { clock: clockAt(START) })
  })

  it('sends nothing for a verified user, an unknown email or a malformed one', async () => {
    const { deps, sent } = setup()
    const verifiedEmail = emailFor('already-verified')
    await createUser(
      databases.app,
      { email: verifiedEmail, displayName: 'Member V', password: PASSWORD, isEmailVerified: true },
      { passwordCost: FAST_COST },
    )

    for (const email of [verifiedEmail, emailFor('nobody'), 'not-an-email']) {
      await expect(
        requestEmailVerification(databases.app, { email }, deps),
      ).resolves.toBeUndefined()
    }
    expect(sent).toEqual([])
  })
})
