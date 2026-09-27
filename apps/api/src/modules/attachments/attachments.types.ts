import type { Database } from '@api/core/db/db.types'
import type { FileStorage } from '@api/core/storage/storage.types'
import type { entryAttachments, files } from '@api/modules/attachments/attachments.table'
import type { AttachmentMimeType, FileSource } from '@financas/shared'

export type FileRow = typeof files.$inferSelect

export type NewFileRow = typeof files.$inferInsert

export type NewEntryAttachmentRow = typeof entryAttachments.$inferInsert

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

export type EntryAttachmentRef = {
  workspaceId: string
  entryId: string
}

export type EntryAttachmentContext = EntryAttachmentRef & {
  userId: string
}

export type DetachFromEntryInput = EntryAttachmentContext & {
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
