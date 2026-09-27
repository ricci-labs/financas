import type { AttachmentMimeType } from '@shared/attachments/attachments.constants'

export type FileSignature = {
  mimeType: AttachmentMimeType
  matches: (bytes: Uint8Array) => boolean
}
