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

export type EmailLink = { label: string; url: string }

export type EmailSpan = string | { strong: string } | { link: EmailLink }

export type EmailParagraph = string | readonly EmailSpan[]

export type EmailIllustration = 'envelope' | 'welcome' | 'key' | 'padlock' | 'invitation'

export type EmailContent = {
  preheader?: string
  greeting?: string
  illustration?: EmailIllustration
  heading: string
  paragraphs: EmailParagraph[]
  action: EmailLink
  notes: string[]
  reason?: string
}

export type RenderedEmail = {
  text: string
  html: string
}

export type Deliver = (message: EmailMessage) => Promise<SentEmail>
