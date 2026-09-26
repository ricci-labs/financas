import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { EmailMessage, Mailer, MailerEnv, SentEmail } from '@api/core/email/email.types'
import type { Logger } from '@api/core/observability/logger'
import { createTransport } from 'nodemailer'
import type SMTPTransport from 'nodemailer/lib/smtp-transport'

const IMPLICIT_TLS_PORT = 465
const MINIMUM_TLS_VERSION = 'TLSv1.2'
const DEVELOPMENT_SENDER = 'no-reply@localhost'

type Deliver = (message: EmailMessage) => Promise<SentEmail>

export function createMailer(env: MailerEnv, logger: Logger): Mailer {
  const deliver = env.SMTP_HOST ? smtpDelivery(env, env.SMTP_HOST) : outboxDelivery(env)

  async function send(message: EmailMessage): Promise<SentEmail> {
    try {
      const sent = await deliver(message)
      logger.info(
        { event: 'email.sent', template: message.template, messageId: sent.messageId },
        'Email sent',
      )
      return sent
    } catch (error) {
      logger.error(
        { event: 'email.send_failed', template: message.template, err: error },
        'Email could not be sent',
      )
      throw error
    }
  }

  return { send }
}

export function smtpTransportOptions(env: MailerEnv, host: string): SMTPTransport.Options {
  const credentials =
    env.SMTP_USER && env.SMTP_PASSWORD
      ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
      : undefined
  return {
    host,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE ?? env.SMTP_PORT === IMPLICIT_TLS_PORT,
    requireTLS: true,
    tls: { minVersion: MINIMUM_TLS_VERSION },
    auth: credentials,
  }
}

function smtpDelivery(env: MailerEnv, host: string): Deliver {
  const transport = createTransport(smtpTransportOptions(env, host))
  return async (message) => {
    const info = await transport.sendMail(toMailOptions(env, message))
    return { messageId: info.messageId }
  }
}

function outboxDelivery(env: MailerEnv): Deliver {
  const transport = createTransport({ streamTransport: true, buffer: true, newline: 'unix' })
  return async (message) => {
    const info = await transport.sendMail(toMailOptions(env, message))
    await mkdir(env.EMAIL_OUTBOX_DIR, { recursive: true })
    await writeFile(join(env.EMAIL_OUTBOX_DIR, outboxFileName()), info.message)
    return { messageId: info.messageId }
  }
}

function toMailOptions(env: MailerEnv, message: EmailMessage) {
  return {
    from: { name: env.EMAIL_FROM_NAME, address: env.EMAIL_FROM ?? DEVELOPMENT_SENDER },
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  }
}

function outboxFileName(): string {
  const sortableTimestamp = new Date().toISOString().replaceAll(':', '-')
  return `${sortableTimestamp}-${randomUUID()}.eml`
}
