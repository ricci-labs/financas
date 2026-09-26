import type { EmailMessage, Mailer } from '@api/core/email/email.types'

const TOKEN_IN_LINK = /#token=([\w-]+)/

export function createRecordingMailer() {
  const sent: EmailMessage[] = []
  const mailer: Mailer = {
    send: async (message) => {
      sent.push(message)
      return { messageId: `test-message-${sent.length}` }
    },
  }
  return { mailer, sent }
}

export function tokenFromEmail(message: EmailMessage | undefined): string {
  const token = message?.text.match(TOKEN_IN_LINK)?.[1]
  if (!token) {
    throw new Error('The email has no link with a token')
  }
  return token
}
