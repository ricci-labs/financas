import type { Clock } from '@api/core/clock.types'
import type { Database, WorkspaceTransaction } from '@api/core/db/db.types'
import type { FileStorage } from '@api/core/storage/storage.types'
import type { files } from '@api/modules/attachments/attachments.table'
import type { AttachmentMimeType, FileSource } from '@financas/shared'

export type FileRow = typeof files.$inferSelect

export type NewFileRow = typeof files.$inferInsert

export type AttachmentRouteDeps = {
  db: Database
  fileStorage: FileStorage
  fileMaxBytes: number
}

export type AttachmentDeps = {
  db: Database
  storage: FileStorage
  maxBytes: number
}

export type PurgeDeps = {
  db: Database
  storage: FileStorage
  clock: Clock
}

export type UploadedFile = {
  name: string
  bytes: Uint8Array
  source: FileSource
}

export type CheckedFile = {
  name: string
  bytes: Uint8Array
  source: FileSource
  mimeType: AttachmentMimeType
  sha256: string
}

export type Uploader = {
  workspaceId: string
  userId: string
}

export type AttachmentTargetKind = 'entry' | 'charge'

export type AttachmentLink = {
  workspaceId: string
  targetId: string
  fileId: string
  userId: string
}

export type AttachmentTarget = {
  notFoundCode: string
  exists: (tx: WorkspaceTransaction, targetId: string) => Promise<boolean>
  link: (tx: WorkspaceTransaction, link: AttachmentLink) => Promise<void>
  unlink: (tx: WorkspaceTransaction, targetId: string, fileId: string) => Promise<boolean>
  items: (tx: WorkspaceTransaction, targetId: string) => Promise<AttachmentItem[]>
}

export type AttachmentTargetRef = {
  workspaceId: string
  kind: AttachmentTargetKind
  targetId: string
}

export type AttachmentContext = AttachmentTargetRef & {
  userId: string
}

export type DetachInput = AttachmentContext & {
  fileId: string
}

export type FileRef = {
  workspaceId: string
  fileId: string
}

export type TrashedBy = {
  userId: string
  at: Date
}

export type AttachedFile = {
  fileId: string
}

export type AttachmentItem = {
  fileId: string
  name: string
  mimeType: AttachmentMimeType
  sizeBytes: number
  attachedAt: Date
  attachedByUserId: string
}

export type FileContent = {
  bytes: Uint8Array<ArrayBuffer>
  mimeType: AttachmentMimeType
  name: string
}

export type ReceivedFile = {
  name: string
  bytes: Uint8Array
}

export type PurgeableFile = {
  id: string
  storageKey: string
}
