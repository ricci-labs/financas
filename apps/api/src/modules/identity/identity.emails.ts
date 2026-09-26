import type { EmailMessage } from '@api/core/email/email.types'
import { renderEmail } from '@api/core/email/layout'
import type { EmailRecipient } from '@api/modules/identity/identity.types'

type VerificationEmail = {
  recipient: EmailRecipient
  verifyLink: string
}

type AccountExistsEmail = {
  recipient: EmailRecipient
  loginLink: string
  forgotPasswordLink: string
}

export function emailVerificationMessage({
  recipient,
  verifyLink,
}: VerificationEmail): EmailMessage {
  const rendered = renderEmail({
    heading: `Olá, ${recipient.displayName}`,
    paragraphs: ['Confirme seu e-mail para começar a usar o Finanças.'],
    action: { label: 'Confirmar e-mail', url: verifyLink },
    notes: [
      'O link vale por 24 horas e só pode ser usado uma vez.',
      'Se você não criou uma conta, ignore este e-mail.',
    ],
  })
  return {
    template: 'email_verification',
    to: recipient.email,
    subject: 'Confirme seu e-mail',
    ...rendered,
  }
}

export function accountAlreadyExistsMessage({
  recipient,
  loginLink,
  forgotPasswordLink,
}: AccountExistsEmail): EmailMessage {
  const rendered = renderEmail({
    heading: `Olá, ${recipient.displayName}`,
    paragraphs: [
      'Alguém tentou criar uma conta no Finanças com este e-mail, mas você já tem uma.',
      `Se foi você, entre com sua senha. Se esqueceu a senha, peça uma nova em ${forgotPasswordLink}`,
    ],
    action: { label: 'Entrar', url: loginLink },
    notes: ['Se não foi você, ignore este e-mail. Nada mudou na sua conta.'],
  })
  return {
    template: 'account_already_exists',
    to: recipient.email,
    subject: 'Você já tem uma conta',
    ...rendered,
  }
}
