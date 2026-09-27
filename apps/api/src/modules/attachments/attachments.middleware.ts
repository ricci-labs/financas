import { ValidationError } from '@api/core/http/errors'
import type { FileContent, ReceivedFile } from '@api/modules/attachments/attachments.types'
import type { HonoRequest } from 'hono'

const FILE_FIELD = 'file'
const NOT_ASCII_OR_QUOTED = /[^\x20-\x7e]|["\\]/g
const NOT_RFC_5987_SAFE = /['()*]/g

export async function receivedFileOf(request: HonoRequest): Promise<ReceivedFile> {
  const file = await request
    .parseBody()
    .then((body) => body[FILE_FIELD])
    .catch(() => undefined)
  if (!(file instanceof File)) {
    throw new ValidationError('FILE_REQUIRED', `Send the file as multipart field "${FILE_FIELD}"`)
  }
  return { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) }
}

export function fileResponseHeaders({ mimeType, name }: FileContent): Record<string, string> {
  return {
    'Content-Type': mimeType,
    'Content-Disposition': `inline; filename="${asciiNameOf(name)}"; filename*=UTF-8''${encodedNameOf(name)}`,
    'Content-Security-Policy': 'sandbox',
    'Cache-Control': 'private, no-store',
  }
}

function asciiNameOf(name: string): string {
  return name.replace(NOT_ASCII_OR_QUOTED, '_')
}

function encodedNameOf(name: string): string {
  return encodeURIComponent(name).replace(
    NOT_RFC_5987_SAFE,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  )
}
