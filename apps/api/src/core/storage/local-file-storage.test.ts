import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createLocalFileStorage, storageKeyOf } from '@api/core/storage/local-file-storage'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const WORKSPACE = '01900000-0000-7000-8000-000000000001'
const SHA = 'a'.repeat(64)
let directory: string

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'financas-files-'))
})

afterAll(async () => {
  await rm(directory, { recursive: true, force: true })
})

describe('createLocalFileStorage', () => {
  it('stores, reads back and removes a file by its key', async () => {
    const storage = createLocalFileStorage(directory)
    const key = storageKeyOf(WORKSPACE, SHA)
    await storage.put(key, new Uint8Array([1, 2, 3]))
    expect(await storage.get(key)).toEqual(new Uint8Array([1, 2, 3]))
    await storage.remove(key)
    expect(await storage.get(key)).toBeNull()
    await storage.remove(key)
  })

  it('refuses keys that could leave its directory', async () => {
    const storage = createLocalFileStorage(directory)
    for (const key of [
      '../etc/passwd',
      `${WORKSPACE}/../../x`,
      `${WORKSPACE}/${SHA}/extra`,
      'plain',
    ]) {
      await expect(storage.put(key, new Uint8Array([1]))).rejects.toThrow(RangeError)
      await expect(storage.get(key)).rejects.toThrow(RangeError)
    }
  })
})
