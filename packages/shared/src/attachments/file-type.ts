import type { AttachmentMimeType } from '@shared/attachments/attachments.constants'
import type { FileSignature } from '@shared/attachments/attachments.types'

const JPEG_START = [0xff, 0xd8, 0xff]
const PNG_START = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const WEBP_FORMAT_OFFSET = 8
const ISO_BOX_TYPE_OFFSET = 4
const ISO_BRAND_OFFSET = 8
const HEIC_BRANDS = ['heic', 'heix', 'mif1']

const SIGNATURES: readonly FileSignature[] = [
  { mimeType: 'image/jpeg', matches: (bytes) => startsWith(bytes, JPEG_START) },
  { mimeType: 'image/png', matches: (bytes) => startsWith(bytes, PNG_START) },
  {
    mimeType: 'image/webp',
    matches: (bytes) =>
      startsWith(bytes, asciiOf('RIFF')) && startsWith(bytes, asciiOf('WEBP'), WEBP_FORMAT_OFFSET),
  },
  {
    mimeType: 'image/heic',
    matches: (bytes) =>
      startsWith(bytes, asciiOf('ftyp'), ISO_BOX_TYPE_OFFSET) &&
      HEIC_BRANDS.some((brand) => startsWith(bytes, asciiOf(brand), ISO_BRAND_OFFSET)),
  },
  { mimeType: 'application/pdf', matches: (bytes) => startsWith(bytes, asciiOf('%PDF-')) },
]

export function detectedMimeTypeOf(bytes: Uint8Array): AttachmentMimeType | null {
  return SIGNATURES.find((signature) => signature.matches(bytes))?.mimeType ?? null
}

function startsWith(bytes: Uint8Array, expected: readonly number[], offset = 0): boolean {
  return expected.every((value, index) => bytes[offset + index] === value)
}

function asciiOf(text: string): number[] {
  return Array.from(text, (character) => character.charCodeAt(0))
}
