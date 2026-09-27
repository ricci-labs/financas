import {
  ATTACHMENT_NAME_MAX_LENGTH,
  type AttachmentMimeType,
} from '@shared/attachments/attachments.constants'

const FALLBACK_NAME = 'anexo'
const PATH_SEPARATORS = /[\\/]/
const CONTROL_CHARACTERS = /\p{Cc}/gu

const EXTENSIONS: Record<AttachmentMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'application/pdf': 'pdf',
}

export function attachmentNameOf(rawName: string, mimeType: AttachmentMimeType): string {
  const baseName = rawName.split(PATH_SEPARATORS).at(-1) ?? ''
  const cleaned = baseName.replace(CONTROL_CHARACTERS, '').trim()
  const name = Array.from(cleaned).slice(0, ATTACHMENT_NAME_MAX_LENGTH).join('').trim()
  return name.length > 0 ? name : `${FALLBACK_NAME}.${EXTENSIONS[mimeType]}`
}
