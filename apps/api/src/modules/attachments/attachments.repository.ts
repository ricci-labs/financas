import type { WorkspaceTransaction } from '@api/core/db/db.types'
import { entryAttachments, files } from '@api/modules/attachments/attachments.table'
import type {
  AttachmentItem,
  FileRow,
  NewEntryAttachmentRow,
  NewFileRow,
  TrashedBy,
} from '@api/modules/attachments/attachments.types'
import { and, asc, eq, isNull } from 'drizzle-orm'

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
  link: NewEntryAttachmentRow,
): Promise<void> {
  await tx.insert(entryAttachments).values(link).onConflictDoNothing()
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
    .innerJoin(
      files,
      and(
        eq(files.workspaceId, entryAttachments.workspaceId),
        eq(files.id, entryAttachments.fileId),
      ),
    )
    .where(and(eq(entryAttachments.entryId, entryId), isNull(files.deletedAt)))
    .orderBy(asc(entryAttachments.createdAt), asc(files.id))
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

export async function isFileAttached(tx: WorkspaceTransaction, fileId: string): Promise<boolean> {
  const [link] = await tx
    .select({ fileId: entryAttachments.fileId })
    .from(entryAttachments)
    .where(eq(entryAttachments.fileId, fileId))
    .limit(1)
  return link !== undefined
}

export async function trashFile(
  tx: WorkspaceTransaction,
  fileId: string,
  { userId, at }: TrashedBy,
): Promise<void> {
  await tx.update(files).set({ deletedAt: at, deletedByUserId: userId }).where(eq(files.id, fileId))
}
