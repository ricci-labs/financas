import type { WorkspaceTransaction } from '@api/core/db/db.types'
import {
  chargeAttachments,
  entryAttachments,
  files,
} from '@api/modules/attachments/attachments.table'
import type {
  AttachmentItem,
  AttachmentLink,
  FileRow,
  NewFileRow,
  PurgeableFile,
  TrashedBy,
} from '@api/modules/attachments/attachments.types'
import { and, asc, eq, inArray, isNull, lt, notExists } from 'drizzle-orm'

const FILE_OF_LINK = {
  entry: and(
    eq(files.workspaceId, entryAttachments.workspaceId),
    eq(files.id, entryAttachments.fileId),
  ),
  charge: and(
    eq(files.workspaceId, chargeAttachments.workspaceId),
    eq(files.id, chargeAttachments.fileId),
  ),
}

export async function upsertFile(tx: WorkspaceTransaction, file: NewFileRow): Promise<string> {
  const [stored] = await tx
    .insert(files)
    .values(file)
    .onConflictDoUpdate({
      target: [files.workspaceId, files.sha256],
      set: { deletedAt: null, deletedByUserId: null, deleteReason: null },
    })
    .returning({ id: files.id })
  if (!stored) {
    throw new Error('File was not stored')
  }
  return stored.id
}

export async function insertEntryAttachment(
  tx: WorkspaceTransaction,
  { workspaceId, targetId, fileId, userId }: AttachmentLink,
): Promise<void> {
  await tx
    .insert(entryAttachments)
    .values({ workspaceId, entryId: targetId, fileId, attachedByUserId: userId })
    .onConflictDoNothing()
}

export async function insertChargeAttachment(
  tx: WorkspaceTransaction,
  { workspaceId, targetId, fileId, userId }: AttachmentLink,
): Promise<void> {
  await tx
    .insert(chargeAttachments)
    .values({ workspaceId, chargeId: targetId, fileId, attachedByUserId: userId })
    .onConflictDoNothing()
}

export function selectEntryAttachments(
  tx: WorkspaceTransaction,
  entryId: string,
): Promise<AttachmentItem[]> {
  return tx
    .select({
      fileId: files.id,
      name: files.originalName,
      mimeType: files.mimeType,
      sizeBytes: files.sizeBytes,
      attachedAt: entryAttachments.createdAt,
      attachedByUserId: entryAttachments.attachedByUserId,
    })
    .from(entryAttachments)
    .innerJoin(files, FILE_OF_LINK.entry)
    .where(and(eq(entryAttachments.entryId, entryId), isNull(files.deletedAt)))
    .orderBy(asc(entryAttachments.createdAt), asc(files.id))
}

export function selectChargeAttachments(
  tx: WorkspaceTransaction,
  chargeId: string,
): Promise<AttachmentItem[]> {
  return tx
    .select({
      fileId: files.id,
      name: files.originalName,
      mimeType: files.mimeType,
      sizeBytes: files.sizeBytes,
      attachedAt: chargeAttachments.createdAt,
      attachedByUserId: chargeAttachments.attachedByUserId,
    })
    .from(chargeAttachments)
    .innerJoin(files, FILE_OF_LINK.charge)
    .where(and(eq(chargeAttachments.chargeId, chargeId), isNull(files.deletedAt)))
    .orderBy(asc(chargeAttachments.createdAt), asc(files.id))
}

export async function selectActiveFile(
  tx: WorkspaceTransaction,
  fileId: string,
): Promise<FileRow | undefined> {
  const [file] = await tx
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), isNull(files.deletedAt)))
  return file
}

export async function lockActiveFile(
  tx: WorkspaceTransaction,
  fileId: string,
): Promise<FileRow | undefined> {
  const [file] = await tx
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), isNull(files.deletedAt)))
    .for('update')
  return file
}

export async function deleteEntryAttachment(
  tx: WorkspaceTransaction,
  entryId: string,
  fileId: string,
): Promise<boolean> {
  const deleted = await tx
    .delete(entryAttachments)
    .where(and(eq(entryAttachments.entryId, entryId), eq(entryAttachments.fileId, fileId)))
    .returning({ fileId: entryAttachments.fileId })
  return deleted.length > 0
}

export async function deleteChargeAttachment(
  tx: WorkspaceTransaction,
  chargeId: string,
  fileId: string,
): Promise<boolean> {
  const deleted = await tx
    .delete(chargeAttachments)
    .where(and(eq(chargeAttachments.chargeId, chargeId), eq(chargeAttachments.fileId, fileId)))
    .returning({ fileId: chargeAttachments.fileId })
  return deleted.length > 0
}

export async function isFileAttached(tx: WorkspaceTransaction, fileId: string): Promise<boolean> {
  const [entryLink] = await tx
    .select({ fileId: entryAttachments.fileId })
    .from(entryAttachments)
    .where(eq(entryAttachments.fileId, fileId))
    .limit(1)
  const [chargeLink] = await tx
    .select({ fileId: chargeAttachments.fileId })
    .from(chargeAttachments)
    .where(eq(chargeAttachments.fileId, fileId))
    .limit(1)
  return entryLink !== undefined || chargeLink !== undefined
}

export async function trashFile(
  tx: WorkspaceTransaction,
  fileId: string,
  { userId, at }: TrashedBy,
): Promise<void> {
  await tx.update(files).set({ deletedAt: at, deletedByUserId: userId }).where(eq(files.id, fileId))
}

export function lockFilesTrashedBefore(
  tx: WorkspaceTransaction,
  cutoff: Date,
  limit: number,
): Promise<PurgeableFile[]> {
  return tx
    .select({ id: files.id, storageKey: files.storageKey })
    .from(files)
    .where(
      and(
        lt(files.deletedAt, cutoff),
        notExists(tx.select().from(entryAttachments).where(FILE_OF_LINK.entry)),
        notExists(tx.select().from(chargeAttachments).where(FILE_OF_LINK.charge)),
      ),
    )
    .orderBy(asc(files.deletedAt))
    .limit(limit)
    .for('update', { skipLocked: true })
}

export async function deleteFiles(tx: WorkspaceTransaction, fileIds: string[]): Promise<void> {
  await tx.delete(files).where(inArray(files.id, fileIds))
}
