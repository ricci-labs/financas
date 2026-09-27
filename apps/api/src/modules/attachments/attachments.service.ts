import { createHash } from 'node:crypto'
import { systemClock } from '@api/core/clock'
import type { Clock } from '@api/core/clock.types'
import type { Database, WorkspaceTransaction } from '@api/core/db/db.types'
import { withWorkspace } from '@api/core/db/tx'
import { NotFoundError, PayloadTooLargeError, ValidationError } from '@api/core/http/errors'
import { storageKeyOf } from '@api/core/storage/local-file-storage'
import type { FileStorage } from '@api/core/storage/storage.types'
import {
  deleteEntryAttachment,
  insertEntryAttachment,
  isFileAttached,
  lockActiveFile,
  selectActiveFile,
  selectEntryAttachments,
  trashFile,
  upsertFile,
} from '@api/modules/attachments/attachments.repository'
import type {
  AttachedFile,
  AttachmentDeps,
  AttachmentItem,
  CheckedFile,
  DetachFromEntryInput,
  EntryAttachmentContext,
  EntryAttachmentRef,
  FileContent,
  FileRef,
  UploadedFile,
  Uploader,
} from '@api/modules/attachments/attachments.types'
import { activeEntryIdsOf } from '@api/modules/ledger'
import { attachmentNameOf, detectedMimeTypeOf } from '@financas/shared'

export async function attachToEntry(
  { db, storage, maxBytes }: AttachmentDeps,
  { workspaceId, userId, entryId }: EntryAttachmentContext,
  upload: UploadedFile,
): Promise<AttachedFile> {
  const file = checkedFileOf(upload, maxBytes)
  return withWorkspace(db, workspaceId, async (tx) => {
    await requireActiveEntry(tx, entryId)
    const fileId = await storeFile(tx, storage, { workspaceId, userId }, file)
    await insertEntryAttachment(tx, { workspaceId, entryId, fileId, attachedByUserId: userId })
    return { fileId }
  })
}

export function listEntryAttachments(
  db: Database,
  { workspaceId, entryId }: EntryAttachmentRef,
): Promise<AttachmentItem[]> {
  return withWorkspace(db, workspaceId, async (tx) => {
    await requireActiveEntry(tx, entryId)
    return selectEntryAttachments(tx, entryId)
  })
}

export function detachFromEntry(
  db: Database,
  { workspaceId, userId, entryId, fileId }: DetachFromEntryInput,
  clock: Clock = systemClock,
): Promise<void> {
  return withWorkspace(db, workspaceId, async (tx) => {
    const file = await lockActiveFile(tx, fileId)
    if (!file || !(await deleteEntryAttachment(tx, entryId, fileId))) {
      throw new NotFoundError('ATTACHMENT_NOT_FOUND', 'This file is not attached to this entry')
    }
    if (!(await isFileAttached(tx, fileId))) {
      await trashFile(tx, fileId, { userId, at: clock.now() })
    }
  })
}

export async function readFileContent(
  { db, storage }: Pick<AttachmentDeps, 'db' | 'storage'>,
  { workspaceId, fileId }: FileRef,
): Promise<FileContent> {
  const file = await withWorkspace(db, workspaceId, (tx) => selectActiveFile(tx, fileId))
  if (!file) {
    throw new NotFoundError('FILE_NOT_FOUND', 'File not found')
  }
  const bytes = await storage.get(file.storageKey)
  if (!bytes) {
    throw new Error(`Stored bytes of file ${file.id} are missing`)
  }
  return { bytes, mimeType: file.mimeType, name: file.originalName }
}

function checkedFileOf(upload: UploadedFile, maxBytes: number): CheckedFile {
  if (upload.bytes.length === 0) {
    throw new ValidationError('FILE_REQUIRED', 'The file is empty')
  }
  if (upload.bytes.length > maxBytes) {
    throw new PayloadTooLargeError('FILE_TOO_LARGE', `Files may have up to ${maxBytes} bytes`)
  }
  const mimeType = detectedMimeTypeOf(upload.bytes)
  if (!mimeType) {
    throw new ValidationError('FILE_TYPE_NOT_ALLOWED', 'Only JPEG, PNG, WebP, HEIC and PDF files')
  }
  return {
    ...upload,
    name: attachmentNameOf(upload.name, mimeType),
    mimeType,
    sha256: createHash('sha256').update(upload.bytes).digest('hex'),
  }
}

async function requireActiveEntry(tx: WorkspaceTransaction, entryId: string): Promise<void> {
  if (!(await activeEntryIdsOf(tx, [entryId])).has(entryId)) {
    throw new NotFoundError('ENTRY_NOT_FOUND', 'Entry not found')
  }
}

async function storeFile(
  tx: WorkspaceTransaction,
  storage: FileStorage,
  { workspaceId, userId }: Uploader,
  file: CheckedFile,
): Promise<string> {
  const storageKey = storageKeyOf(workspaceId, file.sha256)
  const fileId = await upsertFile(tx, {
    workspaceId,
    storageKey,
    mimeType: file.mimeType,
    sizeBytes: file.bytes.length,
    sha256: file.sha256,
    originalName: file.name,
    uploadedByUserId: userId,
    source: file.source,
  })
  await storage.put(storageKey, file.bytes)
  return fileId
}
