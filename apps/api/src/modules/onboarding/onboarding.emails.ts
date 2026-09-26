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
    heading: 'Você recebeu um convite',
    paragraphs: [`${inviterName} convidou você para o workspace "${workspaceName}" no Finanças.`],
    action: { label: 'Ver convite', url: inviteLink },
    notes: [
      'O convite vale por 7 dias e só pode ser aceito com este e-mail.',
      'Se você não esperava este convite, ignore este e-mail.',
    ],
  })
  return {
    template: 'workspace_invitation',
    to: recipientEmail,
    subject: 'Você recebeu um convite no Finanças',
    ...rendered,
  }
}
