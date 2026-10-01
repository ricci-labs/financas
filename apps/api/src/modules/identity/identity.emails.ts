import type { EmailMessage } from '@api/core/email/email.types'
import { renderEmail } from '@api/core/email/layout'
import type {
  AccountExistsEmail,
  PasswordChangedEmail,
  PasswordResetEmail,
  VerificationEmail,
} from '@api/modules/identity/identity.types'

export function emailVerificationMessage({
  recipient,
  verifyLink,
}: VerificationEmail): EmailMessage {
  const rendered = renderEmail({
    preheader: 'Falta um toque para começar a usar o Twise.',
    illustration: 'envelope',
    greeting: `Olá, ${recipient.displayName}!`,
    heading: 'Confirme seu e-mail',
    paragraphs: ['Falta um toque para vocês começarem a usar o Twise.'],
    action: { label: 'Confirmar e-mail', url: verifyLink },
    notes: [
      'O link vale por 24 horas e só pode ser usado uma vez.',
      'Se você não criou uma conta, ignore este e-mail.',
    ],
    reason: 'Você recebeu este e-mail porque alguém criou uma conta com este endereço.',
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
    preheader: 'Alguém tentou criar uma conta com este e-mail.',
    illustration: 'welcome',
    greeting: `Olá, ${recipient.displayName}!`,
    heading: 'Você já tem uma conta',
    paragraphs: [
      'Alguém tentou criar uma conta no Twise com este e-mail, mas você já tem uma.',
      [
        'Se foi você, é só entrar. Esqueceu a senha? ',
        { link: { label: 'Peça uma nova', url: forgotPasswordLink } },
        '.',
      ],
    ],
    action: { label: 'Entrar', url: loginLink },
    notes: ['Se não foi você, ignore este e-mail. Nada mudou na sua conta.'],
    reason: 'Você recebeu este e-mail porque alguém tentou criar uma conta com este endereço.',
  })
  return {
    template: 'account_already_exists',
    to: recipient.email,
    subject: 'Você já tem uma conta',
    ...rendered,
  }
}

export function passwordResetMessage({ recipient, resetLink }: PasswordResetEmail): EmailMessage {
  const rendered = renderEmail({
    preheader: 'O link vale por 1 hora.',
    illustration: 'key',
    greeting: `Olá, ${recipient.displayName}!`,
    heading: 'Vamos criar uma nova senha',
    paragraphs: ['Recebemos um pedido para trocar a senha da sua conta no Twise.'],
    action: { label: 'Criar nova senha', url: resetLink },
    notes: [
      'O link vale por 1 hora e só pode ser usado uma vez.',
      'Se você não pediu, ignore este e-mail. Sua senha continua a mesma.',
    ],
    reason: 'Você recebeu este e-mail porque pediram para trocar a senha desta conta.',
  })
  return {
    template: 'password_reset',
    to: recipient.email,
    subject: 'Troque sua senha',
    ...rendered,
  }
}

export function passwordChangedMessage({
  recipient,
  forgotPasswordLink,
}: PasswordChangedEmail): EmailMessage {
  const rendered = renderEmail({
    preheader: 'Saímos de todos os aparelhos por segurança.',
    illustration: 'padlock',
    greeting: `Olá, ${recipient.displayName}!`,
    heading: 'Sua senha foi trocada',
    paragraphs: [
      'A senha da sua conta no Twise foi trocada, e saímos de todos os aparelhos por segurança.',
      'Se foi você, está tudo certo. Não precisa fazer nada.',
    ],
    action: { label: 'Não fui eu: trocar a senha', url: forgotPasswordLink },
    notes: ['Se não foi você, troque a senha agora pelo botão acima.'],
    reason: 'Você recebeu este e-mail porque a senha desta conta mudou.',
  })
  return {
    template: 'password_changed',
    to: recipient.email,
    subject: 'Sua senha foi trocada',
    ...rendered,
  }
}
