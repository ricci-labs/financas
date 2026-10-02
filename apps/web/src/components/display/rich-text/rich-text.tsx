import type {
  RichTextPart,
  RichTextProps,
  RichTextValues,
} from '@web/components/display/rich-text/rich-text.types'
import { fill } from '@web/lib/format/template'

const STRONG_MARKER = '**'

export function RichText({ text, values = {} }: RichTextProps) {
  return partsOf(text, values).map((part) =>
    part.isStrong ? (
      <strong key={part.position} className="font-bold">
        {part.text}
      </strong>
    ) : (
      part.text
    ),
  )
}

export function partsOf(text: string, values: RichTextValues): RichTextPart[] {
  return fill(text, values)
    .split(STRONG_MARKER)
    .map((piece, position) => ({ position, text: piece, isStrong: position % 2 === 1 }))
    .filter((part) => part.text !== '')
}
