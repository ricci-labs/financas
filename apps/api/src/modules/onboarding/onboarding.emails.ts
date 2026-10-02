import type { EmailMessage } from '@api/core/email/email.types'
import { renderEmail } from '@api/core/email/layout'
import type { InvitationEmail } from '@api/modules/onboarding/onboarding.types'

export function invitationMessage({
  recipientEmail,
  workspaceName,
  inviterName,
  inviteLink,
}: InvitationEmail): EmailMessage {
  const rendered = renderEmail({
    preheader: `${inviterName} convidou você para o espaço ${workspaceName}.`,
    illustration: 'invitation',
    greeting: 'Oi!',
    heading: `${inviterName} convidou você`,
    paragraphs: [
      [
        `${inviterName} convidou você para o espaço `,
        { strong: workspaceName },
        ' no Twise, para cuidarem juntos do dinheiro do mês.',
      ],
    ],
    action: { label: 'Ver convite', url: inviteLink },
    notes: [
      'O convite vale por 7 dias e só pode ser aceito com este e-mail.',
      'Se você não esperava este convite, ignore este e-mail.',
    ],
    reason: `Você recebeu este e-mail porque ${inviterName} convidou este endereço.`,
  })
  return {
    template: 'workspace_invitation',
    to: recipientEmail,
    subject: 'Você recebeu um convite no Twise',
    ...rendered,
  }
}
