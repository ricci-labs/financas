import type { Env } from '@api/core/config/env.schemas'

export type MailerEnv = Pick<
  Env,
  | 'SMTP_HOST'
  | 'SMTP_PORT'
  | 'SMTP_SECURE'
  | 'SMTP_USER'
  | 'SMTP_PASSWORD'
  | 'EMAIL_FROM'
  | 'EMAIL_FROM_NAME'
  | 'EMAIL_OUTBOX_DIR'
>

export type EmailMessage = {
  template: string
  to: string
  subject: string
  text: string
  html: string
}

export type SentEmail = {
  messageId: string
}

export type Mailer = {
  send: (message: EmailMessage) => Promise<SentEmail>
}

export type EmailContent = {
  heading: string
  paragraphs: string[]
  action: { label: string; url: string }
  notes: string[]
}

export type RenderedEmail = {
  text: string
  html: string
}
