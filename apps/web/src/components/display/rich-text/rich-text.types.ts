export type RichTextValues = Readonly<Record<string, string | number>>

export type RichTextProps = {
  text: string
  values?: RichTextValues
}

export type RichTextPart = {
  position: number
  text: string
  isStrong: boolean
}
