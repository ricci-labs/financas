import type { ReactNode } from 'react'

export type RichTextValues = Readonly<Record<string, string | number>>

export type RichTextProps = {
  text: string
  values?: RichTextValues
  link?: (label: string) => ReactNode
}

export type RichTextKind = 'plain' | 'strong' | 'link'

export type RichTextPart = {
  position: number
  text: string
  kind: RichTextKind
}
