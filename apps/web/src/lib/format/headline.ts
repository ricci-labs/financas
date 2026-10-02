const SENTENCE_END = '. '

export function headlineOf(message: string): { title: string; text: string } {
  const end = message.indexOf(SENTENCE_END)
  if (end === -1) {
    return { title: message, text: '' }
  }
  return { title: message.slice(0, end), text: message.slice(end + SENTENCE_END.length) }
}
