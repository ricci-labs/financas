import { hashPassword, passwordNeedsRehash, verifyPassword } from '@api/core/security/passwords'
import type { PasswordCost } from '@api/core/security/security.types'
import { describe, expect, it } from 'vitest'

const FAST_TEST_COST: PasswordCost = { cpuMemoryCost: 2 ** 10, blockSize: 8, parallelization: 1 }
const PASSWORD = 'correct horse battery staple'

describe('hashPassword', () => {
  it('stores the algorithm, the cost, a salt and the key', async () => {
    const stored = await hashPassword(PASSWORD, FAST_TEST_COST)
    expect(stored).toMatch(/^scrypt\$1024\$8\$1\$[\w-]{22}\$[\w-]{86}$/)
  })

  it('uses a new salt every time', async () => {
    const first = await hashPassword(PASSWORD, FAST_TEST_COST)
    const second = await hashPassword(PASSWORD, FAST_TEST_COST)
    expect(first).not.toEqual(second)
  })

  it('uses the OWASP cost by default', async () => {
    expect(await hashPassword(PASSWORD)).toMatch(/^scrypt\$131072\$8\$1\$/)
  })
})

describe('verifyPassword', () => {
  it('accepts the right password', async () => {
    const stored = await hashPassword(PASSWORD, FAST_TEST_COST)
    expect(await verifyPassword(PASSWORD, stored)).toBe(true)
  })

  it('rejects a wrong password', async () => {
    const stored = await hashPassword(PASSWORD, FAST_TEST_COST)
    expect(await verifyPassword('correct horse battery stapler', stored)).toBe(false)
  })

  it('reads the cost from the stored hash, so the default can grow later', async () => {
    const olderCost: PasswordCost = { cpuMemoryCost: 2 ** 11, blockSize: 4, parallelization: 2 }
    const stored = await hashPassword(PASSWORD, olderCost)
    expect(await verifyPassword(PASSWORD, stored)).toBe(true)
  })

  it('treats equivalent Unicode forms as the same password', async () => {
    const composed = 'senha com ação'.normalize('NFC')
    const decomposed = composed.normalize('NFD')
    const stored = await hashPassword(composed, FAST_TEST_COST)
    expect(await verifyPassword(decomposed, stored)).toBe(true)
  })

  it('rejects a user without a password after the same work as a real check', async () => {
    expect(await verifyPassword(PASSWORD, null)).toBe(false)
  })

  it('refuses a stored hash in an unknown format', async () => {
    const stored = await hashPassword(PASSWORD, FAST_TEST_COST)
    const unknownFormats = [
      stored.replace('scrypt', 'bcrypt'),
      `${stored}$extra`,
      stored.replace('$1024$', '$abc$'),
      stored.slice(0, -4),
      stored.replace('$1024$', '$1000$'),
      stored.replace('$1024$', '$1073741824$'),
      stored.replace('$8$1$', '$8$64$'),
    ]
    for (const unknownFormat of unknownFormats) {
      await expect(verifyPassword(PASSWORD, unknownFormat)).rejects.toThrow(/unknown format/)
    }
  })
})

describe('passwordNeedsRehash', () => {
  it('asks for a new hash when the stored cost is below the current one', async () => {
    const stored = await hashPassword(PASSWORD, FAST_TEST_COST)
    expect(passwordNeedsRehash(stored)).toBe(true)
  })

  it('keeps a hash made with the current cost', async () => {
    const stored = await hashPassword(PASSWORD, FAST_TEST_COST)
    expect(passwordNeedsRehash(stored, FAST_TEST_COST)).toBe(false)
  })
})
