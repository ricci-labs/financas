import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import type { FileStorage } from '@api/core/storage/storage.types'

const KEY_PATTERN = /^[0-9a-f-]{36}\/[0-9a-f]{64}$/

export function createLocalFileStorage(directory: string): FileStorage {
  const root = resolve(directory)
  const pathOf = (key: string) => {
    if (!KEY_PATTERN.test(key)) {
      throw new RangeError(`Invalid storage key: ${key}`)
    }
    return join(root, key)
  }
  return {
    put: async (key, bytes) => {
      const path = pathOf(key)
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, bytes, { flag: 'w' })
    },
    get: async (key) => {
      try {
        return new Uint8Array(await readFile(pathOf(key)))
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return null
        }
        throw error
      }
    },
    remove: async (key) => {
      await rm(pathOf(key), { force: true })
    },
  }
}

export function storageKeyOf(workspaceId: string, sha256: string): string {
  return `${workspaceId}/${sha256}`
}
