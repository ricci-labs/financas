import { Button } from '@web/components/actions/button'
import { TextLink } from '@web/components/actions/text-link'
import { Alert } from '@web/components/feedback/alert/alert'
import type { ComponentExamples } from '@web/lib/examples.types'

export const alertExamples: ComponentExamples = {
  component: 'Alert',
  examples: [
    {
      name: 'Erro do formulário',
      render: () => (
        <Alert tone="danger" isUrgent>
          E-mail ou senha incorretos.
        </Alert>
      ),
    },
    {
      name: 'Com ação',
      render: () => (
        <Alert
          tone="warning"
          isUrgent
          action={
            <Button variant="subtle" size="sm">
              Reenviar e-mail de confirmação
            </Button>
          }
        >
          Confirme seu e-mail antes de entrar. Procure o link que enviamos.
        </Alert>
      ),
    },
    {
      name: 'Com link na frase',
      render: () => (
        <Alert tone="danger" isUrgent>
          Já existe uma conta com esse e-mail.{' '}
          <TextLink tone="inherit" href="#entrar">
            Entre com ela
          </TextLink>{' '}
          para aceitar o convite.
        </Alert>
      ),
    },
    {
      name: 'Chegada (sucesso)',
      render: () => (
        <Alert tone="success">
          Senha trocada. Entre com a nova senha. Por segurança, saímos de todos os aparelhos.
        </Alert>
      ),
    },
    { name: 'Chegada (informação)', render: () => <Alert tone="info">Você saiu.</Alert> },
  ],
}
