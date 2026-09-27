import { attachmentNameOf } from '@shared/attachments/file-name'
import { detectedMimeTypeOf } from '@shared/attachments/file-type'
import { describe, expect, it } from 'vitest'

function bytesOf(...parts: (string | number[])[]): Uint8Array {
  return new Uint8Array(
    parts.flatMap((part) =>
      typeof part === 'string' ? Array.from(part, (character) => character.charCodeAt(0)) : part,
    ),
  )
}

describe('detectedMimeTypeOf', () => {
  it.each([
    ['image/jpeg', bytesOf([0xff, 0xd8, 0xff, 0xe0], 'rest')],
    ['image/png', bytesOf([0x89], 'PNG', [0x0d, 0x0a, 0x1a, 0x0a], 'rest')],
    ['image/webp', bytesOf('RIFF', [1, 2, 3, 4], 'WEBPVP8 ')],
    ['image/heic', bytesOf([0, 0, 0, 24], 'ftypheic', [0, 0, 0, 0])],
    ['image/heic', bytesOf([0, 0, 0, 24], 'ftypmif1', [0, 0, 0, 0])],
    ['application/pdf', bytesOf('%PDF-1.7\n')],
  ])('recognises %s by its first bytes', (mimeType, bytes) => {
    expect(detectedMimeTypeOf(bytes)).toBe(mimeType)
  })

  it.each([
    ['an HTML page', bytesOf('<html><script>')],
    ['an SVG', bytesOf('<svg xmlns="http://www.w3.org/2000/svg">')],
    ['a RIFF that is not WebP', bytesOf('RIFF', [1, 2, 3, 4], 'WAVEfmt ')],
    ['an ISO file of another brand', bytesOf([0, 0, 0, 24], 'ftypisom')],
    ['a truncated JPEG', bytesOf([0xff, 0xd8])],
    ['nothing', new Uint8Array()],
  ])('refuses %s', (_, bytes) => {
    expect(detectedMimeTypeOf(bytes)).toBeNull()
  })
})

describe('attachmentNameOf', () => {
  it('keeps only the base name, without control characters or outer spaces', () => {
    expect(attachmentNameOf('C:\\fotos\\nota fiscal.jpg', 'image/jpeg')).toBe('nota fiscal.jpg')
    expect(attachmentNameOf('../../etc/recibo.pdf', 'application/pdf')).toBe('recibo.pdf')
    expect(attachmentNameOf('  re\u0000ci\nbo.png  ', 'image/png')).toBe('recibo.png')
  })

  it('cuts a long name at 255 characters without splitting one', () => {
    const name = attachmentNameOf(`${'a'.repeat(254)}😀😀.png`, 'image/png')
    expect(Array.from(name)).toHaveLength(255)
    expect(name.endsWith('😀')).toBe(true)
  })

  it('names an unnamed file after its type', () => {
    expect(attachmentNameOf('', 'application/pdf')).toBe('anexo.pdf')
    expect(attachmentNameOf('folder/', 'image/heic')).toBe('anexo.heic')
    expect(attachmentNameOf(' \u0007 ', 'image/webp')).toBe('anexo.webp')
  })
})
