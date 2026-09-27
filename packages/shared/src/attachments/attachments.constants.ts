export const ATTACHMENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
] as const

export type AttachmentMimeType = (typeof ATTACHMENT_MIME_TYPES)[number]

export const FILE_SOURCES = ['web', 'whatsapp'] as const

export type FileSource = (typeof FILE_SOURCES)[number]

export const ATTACHMENT_NAME_MAX_LENGTH = 255

export const TRASHED_FILE_RETENTION_DAYS = 30
