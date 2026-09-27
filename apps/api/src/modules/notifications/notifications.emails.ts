import type { EmailMessage } from '@api/core/email/email.types'
import { renderEmail } from '@api/core/email/layout'
import type { NotificationEmailInput } from '@api/modules/notifications/notifications.types'
import {
  billReminderPayloadSchema,
  formatBrl,
  type IsoDate,
  invoiceReminderPayloadSchema,
} from '@financas/shared'

export function notificationEmail({
  kind,
  payload,
  recipient,
  appLink,
}: NotificationEmailInput): EmailMessage | null {
  switch (kind) {
    case 'bill_reminder': {
      const bill = billReminderPayloadSchema.safeParse(payload)
      if (!bill.success) {
        return null
      }
      const amount = `${bill.data.isEstimate ? 'cerca de ' : ''}${formatBrl(bill.data.amountCents)}`
      return {
        template: 'bill_reminder',
        to: recipient.email,
        subject: `${bill.data.description} vence em ${brazilianDate(bill.data.dueOn)}`,
        ...renderEmail({
          heading: `Olá, ${recipient.displayName}`,
          paragraphs: [
            `Lembrete: ${bill.data.description} vence em ${brazilianDate(bill.data.dueOn)}, no valor de ${amount}.`,
          ],
          action: { label: 'Abrir o Finanças', url: appLink },
          notes: ['Se já pagou, registre o pagamento para o lembrete sair da lista.'],
        }),
      }
    }
    case 'invoice_reminder': {
      const invoice = invoiceReminderPayloadSchema.safeParse(payload)
      if (!invoice.success) {
        return null
      }
      return {
        template: 'invoice_reminder',
        to: recipient.email,
        subject: `Fatura do ${invoice.data.cardName} vence em ${brazilianDate(invoice.data.dueOn)}`,
        ...renderEmail({
          heading: `Olá, ${recipient.displayName}`,
          paragraphs: [
            `A fatura do ${invoice.data.cardName} vence em ${brazilianDate(invoice.data.dueOn)}, com ${formatBrl(invoice.data.amountCents)} até agora.`,
          ],
          action: { label: 'Ver a fatura', url: appLink },
          notes: ['O valor pode mudar até o fechamento.'],
        }),
      }
    }
    default:
      return null
  }
}

function brazilianDate(date: IsoDate): string {
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}
