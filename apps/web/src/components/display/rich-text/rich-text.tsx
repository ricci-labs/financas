import type {
  RichTextKind,
  RichTextPart,
  RichTextProps,
  RichTextValues,
} from '@web/components/display/rich-text/rich-text.types'
import { fill } from '@web/lib/format/template'
import { Fragment } from 'react'

const MARKED_PIECE = /(\*\*.+?\*\*|\[.+?\])/
const STRONG_MARKER = '**'
const LINK_OPEN = '['
const LINK_CLOSE = ']'

export function RichText({ text, values = {}, link }: RichTextProps) {
  return partsOf(text, values).map((part) => {
    if (part.kind === 'strong') {
      return (
        <strong key={part.position} className="font-bold">
          {part.text}
        </strong>
      )
    }
    if (part.kind === 'link' && link) {
      return <Fragment key={part.position}>{link(part.text)}</Fragment>
    }
    return part.text
  })
}

export function partsOf(text: string, values: RichTextValues): RichTextPart[] {
  return text
    .split(MARKED_PIECE)
    .filter((piece) => piece !== '')
    .map((piece, position) => {
      const kind = kindOf(piece)
      return { position, kind, text: fill(unmarked(piece, kind), values) }
    })
}

function kindOf(piece: string): RichTextKind {
  if (piece.startsWith(STRONG_MARKER) && piece.endsWith(STRONG_MARKER)) {
    return 'strong'
  }
  return piece.startsWith(LINK_OPEN) && piece.endsWith(LINK_CLOSE) ? 'link' : 'plain'
}

function unmarked(piece: string, kind: RichTextKind): string {
  if (kind === 'strong') {
    return piece.slice(STRONG_MARKER.length, -STRONG_MARKER.length)
  }
  return kind === 'link' ? piece.slice(LINK_OPEN.length, -LINK_CLOSE.length) : piece
}
