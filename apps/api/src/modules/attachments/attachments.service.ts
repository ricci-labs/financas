import { createHash } from 'node:crypto'
import { systemClock } from '@api/core/clock'
import type { Clock } from '@api/core/clock.types'
import type { Database, WorkspaceTransaction } from '@api/core/db/db.types'
import { withWorkspace } from '@api/core/db/tx'
import { NotFoundError, PayloadTooLargeError, ValidationError } from '@api/core/http/errors'
import { storageKeyOf } from '@api/core/storage/local-file-storage'
import type { FileStorage } from '@api/core/storage/storage.types'
import {
  deleteChargeAttachment,
  deleteEntryAttachment,
  deleteFiles,
  insertChargeAttachment,
  insertEntryAttachment,
  isFileAttached,
  lockActiveFile,
  lockFilesTrashedBefore,
  selectActiveFile,
  selectChargeAttachments,
  selectEntryAttachments,
  trashFile,
  upsertFile,
} from '@api/modules/attachments/attachments.repository'
import type {
  AttachedFile,
  AttachmentContext,
  AttachmentDeps,
  AttachmentItem,
  AttachmentTarget,
  AttachmentTargetKind,
  AttachmentTargetRef,
  CheckedFile,
  DetachInput,
  FileContent,
  FileRef,
  PurgeDeps,
  UploadedFile,
  Uploader,
} from '@api/modules/attachments/attachments.types'
import { chargeExists } from '@api/modules/contacts'
import { activeEntryIdsOf } from '@api/modules/ledger'
import { attachmentNameOf, detectedMimeTypeOf, TRASHED_FILE_RETENTION_DAYS } from '@financas/shared'

const PURGE_BATCH_SIZE = 100
const MS_PER_DAY = 24 * 60 * 60 * 1000

const TARGETS: Record<AttachmentTargetKind, AttachmentTarget> = {
  entry: {
    notFoundCode: 'ENTRY_NOT_FOUND',
    exists: async (tx, entryId) => (await activeEntryIdsOf(tx, [entryId])).has(entryId),
    link: insertEntryAttachment,
    unlink: deleteEntryAttachment,
    items: selectEntryAttachments,
  },
  charge: {
    notFoundCode: 'CHARGE_NOT_FOUND',
    exists: chargeExists,
    link: insertChargeAttachment,
    unlink: deleteChargeAttachment,
    items: selectChargeAttachments,
  },
}

export async function attachFile(
  { db, storage, maxBytes }: AttachmentDeps,
  { workspaceId, userId, kind, targetId }: AttachmentContext,
  upload: UploadedFile,
): Promise<AttachedFile> {
  const file = checkedFileOf(upload, maxBytes)
  const target = TARGETS[kind]
  return withWorkspace(db, workspaceId, async (tx) => {
    await requireTarget(tx, target, targetId)
    const fileId = await storeFile(tx, storage, { workspaceId, userId }, file)
    await target.link(tx, { workspaceId, targetId, fileId, userId })
    return { fileId }
  })
}

export function listAttachments(
  db: Database,
  { workspaceId, kind, targetId }: AttachmentTargetRef,
): Promise<AttachmentItem[]> {
  const target = TARGETS[kind]
  return withWorkspace(db, workspaceId, async (tx) => {
    await requireTarget(tx, target, targetId)
    return target.items(tx, targetId)
  })
}

export function detachFile(
  db: Database,
  { workspaceId, userId, kind, targetId, fileId }: DetachInput,
  clock: Clock = systemClock,
): Promise<void> {
  return withWorkspace(db, workspaceId, async (tx) => {
    const file = await lockActiveFile(tx, fileId)
    if (!file || !(await TARGETS[kind].unlink(tx, targetId, fileId))) {
      throw new NotFoundError('ATTACHMENT_NOT_FOUND', 'This file is not attached here')
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

export function purgeTrashedFiles(
  { db, storage, clock }: PurgeDeps,
  workspaceId: string,
): Promise<number> {
  const cutoff = new Date(clock.now().getTime() - TRASHED_FILE_RETENTION_DAYS * MS_PER_DAY)
  return withWorkspace(db, workspaceId, async (tx) => {
    const purgeable = await lockFilesTrashedBefore(tx, cutoff, PURGE_BATCH_SIZE)
    for (const file of purgeable) {
      await storage.remove(file.storageKey)
    }
    if (purgeable.length > 0) {
      await deleteFiles(
        tx,
        purgeable.map((file) => file.id),
      )
    }
    return purgeable.length
  })
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

async function requireTarget(
  tx: WorkspaceTransaction,
  target: AttachmentTarget,
  targetId: string,
): Promise<void> {
  if (!(await target.exists(tx, targetId))) {
    throw new NotFoundError(target.notFoundCode, 'Nothing to attach to here')
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
