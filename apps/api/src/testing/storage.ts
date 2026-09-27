import type { FileStorage } from '@api/core/storage/storage.types'

export function createMemoryFileStorage() {
  const stored = new Map<string, Uint8Array<ArrayBuffer>>()
  const storage: FileStorage = {
    put: async (key, bytes) => {
      stored.set(key, new Uint8Array(bytes))
    },
    get: async (key) => stored.get(key) ?? null,
    remove: async (key) => {
      stored.delete(key)
    },
  }
  return { storage, stored }
}
