import { randomBytes, type ScryptOptions, scrypt, timingSafeEqual } from 'node:crypto'
import { createConcurrencyLimit } from '@api/core/concurrency'
import type { PasswordCost } from '@api/core/security/security.types'

export const OWASP_PASSWORD_COST: PasswordCost = {
  cpuMemoryCost: 2 ** 17,
  blockSize: 8,
  parallelization: 1,
}

const ALGORITHM = 'scrypt'
const FIELD_SEPARATOR = '$'
const SALT_BYTES = 16
const KEY_BYTES = 64
const BYTES_PER_BLOCK_UNIT = 128
const MEMORY_HEADROOM = 2
const MAX_CONCURRENT_DERIVATIONS = 2

const MAX_ACCEPTED_COST: PasswordCost = {
  cpuMemoryCost: 2 ** 20,
  blockSize: 16,
  parallelization: 4,
}

const runDerivationLimited = createConcurrencyLimit(MAX_CONCURRENT_DERIVATIONS)

export async function hashPassword(
  password: string,
  cost: PasswordCost = OWASP_PASSWORD_COST,
): Promise<string> {
  const salt = randomBytes(SALT_BYTES)
  const key = await deriveKey(password, salt, cost)
  return [
    ALGORITHM,
    cost.cpuMemoryCost,
    cost.blockSize,
    cost.parallelization,
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join(FIELD_SEPARATOR)
}

export async function verifyPassword(
  password: string,
  storedHash: string | null,
): Promise<boolean> {
  if (storedHash === null) {
    await verifyAgainstDummyHash(password)
    return false
  }

  const { cost, salt, key } = parseStoredHash(storedHash)
  const candidate = await deriveKey(password, salt, cost)
  return timingSafeEqual(candidate, key)
}

export function passwordNeedsRehash(
  storedHash: string,
  cost: PasswordCost = OWASP_PASSWORD_COST,
): boolean {
  const stored = parseStoredHash(storedHash).cost
  return (
    stored.cpuMemoryCost < cost.cpuMemoryCost ||
    stored.blockSize < cost.blockSize ||
    stored.parallelization < cost.parallelization
  )
}

async function verifyAgainstDummyHash(password: string): Promise<void> {
  await deriveKey(password, randomBytes(SALT_BYTES), OWASP_PASSWORD_COST)
}

function parseStoredHash(storedHash: string) {
  const [algorithm, cpuMemoryCost, blockSize, parallelization, salt, key, ...extra] =
    storedHash.split(FIELD_SEPARATOR)
  const cost = {
    cpuMemoryCost: Number(cpuMemoryCost),
    blockSize: Number(blockSize),
    parallelization: Number(parallelization),
  }
  const saltBytes = Buffer.from(salt ?? '', 'base64url')
  const keyBytes = Buffer.from(key ?? '', 'base64url')

  const isWellFormed =
    algorithm === ALGORITHM &&
    extra.length === 0 &&
    isAcceptedCost(cost) &&
    saltBytes.length === SALT_BYTES &&
    keyBytes.length === KEY_BYTES
  if (!isWellFormed) {
    throw new Error('Stored password hash has an unknown format')
  }

  return { cost, salt: saltBytes, key: keyBytes }
}

function isAcceptedCost(cost: PasswordCost): boolean {
  return (
    isIntegerBetween(cost.cpuMemoryCost, 2, MAX_ACCEPTED_COST.cpuMemoryCost) &&
    isPowerOfTwo(cost.cpuMemoryCost) &&
    isIntegerBetween(cost.blockSize, 1, MAX_ACCEPTED_COST.blockSize) &&
    isIntegerBetween(cost.parallelization, 1, MAX_ACCEPTED_COST.parallelization)
  )
}

function isIntegerBetween(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max
}

function isPowerOfTwo(value: number): boolean {
  return Number.isInteger(Math.log2(value))
}

function deriveKey(password: string, salt: Buffer, cost: PasswordCost): Promise<Buffer> {
  const options: ScryptOptions = {
    N: cost.cpuMemoryCost,
    r: cost.blockSize,
    p: cost.parallelization,
    maxmem: requiredMemory(cost) * MEMORY_HEADROOM,
  }
  return runDerivationLimited(
    () =>
      new Promise((resolve, reject) => {
        scrypt(password.normalize('NFKC'), salt, KEY_BYTES, options, (error, key) => {
          if (error) {
            reject(error)
            return
          }
          resolve(key)
        })
      }),
  )
}

function requiredMemory(cost: PasswordCost): number {
  return BYTES_PER_BLOCK_UNIT * cost.cpuMemoryCost * cost.blockSize
}
