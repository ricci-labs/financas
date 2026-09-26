import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { EmailMessage, MailerEnv } from '@api/core/email/email.types'
import { createMailer, smtpTransportOptions } from '@api/core/email/mailer'
import { createLogger } from '@api/core/observability/logger'
import { afterEach, describe, expect, it } from 'vitest'

const SMTP_HOST = 'smtp.example.test'
const UNREACHABLE_PORT = 1
const RECIPIENT = 'member.a@example.test'
const SMTP_PASSWORD = 'smtp-secret-value'

const BASE_ENV: MailerEnv = {
  SMTP_HOST: undefined,
  SMTP_PORT: 587,
  SMTP_SECURE: undefined,
  SMTP_USER: undefined,
  SMTP_PASSWORD: undefined,
  EMAIL_FROM: 'no-reply@example.test',
  EMAIL_FROM_NAME: 'Finanças',
  EMAIL_OUTBOX_DIR: '.private/outbox',
}

const MESSAGE: EmailMessage = {
  template: 'test_message',
  to: RECIPIENT,
  subject: 'Test subject',
  text: 'Body with a private link https://example.test/reset?token=abc',
  html: '<p>Body with a private link</p>',
}

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.map((dir) => rm(dir, { recursive: true, force: true })))
  temporaryDirectories.length = 0
})

function capturingLogger() {
  const lines: string[] = []
  const logger = createLogger(
    { LOG_LEVEL: 'info', NODE_ENV: 'test', APP_VERSION: 'test-sha' },
    { write: (line: string) => lines.push(line) },
  )
  return { logger, output: () => lines.join('') }
}

describe('smtpTransportOptions', () => {
  it('uses STARTTLS on 587 and always requires TLS 1.2 or later', () => {
    expect(smtpTransportOptions(BASE_ENV, SMTP_HOST)).toMatchObject({
      host: SMTP_HOST,
      port: 587,
      secure: false,
      requireTLS: true,
      tls: { minVersion: 'TLSv1.2' },
      auth: undefined,
    })
  })

  it('uses implicit TLS on 465 unless SMTP_SECURE says otherwise', () => {
    expect(smtpTransportOptions({ ...BASE_ENV, SMTP_PORT: 465 }, SMTP_HOST).secure).toBe(true)
    const forced = { ...BASE_ENV, SMTP_PORT: 465, SMTP_SECURE: false }
    expect(smtpTransportOptions(forced, SMTP_HOST).secure).toBe(false)
  })

  it('logs in only when user and password are both set', () => {
    const withLogin = { ...BASE_ENV, SMTP_USER: 'sender', SMTP_PASSWORD }
    expect(smtpTransportOptions(withLogin, SMTP_HOST).auth).toEqual({
      user: 'sender',
      pass: SMTP_PASSWORD,
    })
  })
})

describe('createMailer without SMTP', () => {
  it('writes the message as an .eml file in the outbox folder', async () => {
    const outbox = await mkdtemp(join(tmpdir(), 'financas-outbox-'))
    temporaryDirectories.push(outbox)
    const { logger } = capturingLogger()

    const sent = await createMailer({ ...BASE_ENV, EMAIL_OUTBOX_DIR: outbox }, logger).send(MESSAGE)

    const [fileName] = await readdir(outbox)
    expect(fileName).toMatch(/\.eml$/)
    const email = await readFile(join(outbox, fileName ?? ''), 'utf8')
    expect(email).toContain('Subject: Test subject')
    expect(email).toContain(`To: ${RECIPIENT}`)
    expect(email).toContain('no-reply@example.test')
    expect(email).toContain(sent.messageId)
  })

  it('logs the template and message id, never the recipient or the body', async () => {
    const outbox = await mkdtemp(join(tmpdir(), 'financas-outbox-'))
    temporaryDirectories.push(outbox)
    const { logger, output } = capturingLogger()

    await createMailer({ ...BASE_ENV, EMAIL_OUTBOX_DIR: outbox }, logger).send(MESSAGE)

    expect(output()).toContain('"event":"email.sent"')
    expect(output()).toContain('"template":"test_message"')
    expect(output()).not.toContain(RECIPIENT)
    expect(output()).not.toContain('private link')
  })
})

describe('createMailer with SMTP', () => {
  it('fails loudly and logs the failure without the SMTP password', async () => {
    const { logger, output } = capturingLogger()
    const unreachable = {
      ...BASE_ENV,
      SMTP_HOST: '127.0.0.1',
      SMTP_PORT: UNREACHABLE_PORT,
      SMTP_USER: 'sender',
      SMTP_PASSWORD,
    }

    await expect(createMailer(unreachable, logger).send(MESSAGE)).rejects.toThrow()

    expect(output()).toContain('"event":"email.send_failed"')
    expect(output()).not.toContain(SMTP_PASSWORD)
    expect(output()).not.toContain(RECIPIENT)
  })
})
