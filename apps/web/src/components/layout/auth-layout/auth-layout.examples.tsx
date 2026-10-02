import { Button } from '@web/components/actions/button'
import { TextLink } from '@web/components/actions/text-link'
import { Alert } from '@web/components/feedback/alert'
import { AuthLayout } from '@web/components/layout/auth-layout/auth-layout'
import type { ComponentExamples } from '@web/lib/examples.types'

export const authLayoutExamples: ComponentExamples = {
  component: 'AuthLayout',
  examples: [
    {
      name: 'Entrar (com mensagem de chegada)',
      render: () => (
        <div className="w-full overflow-hidden rounded-lg border">
          <AuthLayout
            className="min-h-180"
            scene="welcome"
            title="Entrar no Twise"
            subtitle="Bom te ver de novo! Vamos ver como anda o mês?"
            notice={<Alert tone="info">Você saiu.</Alert>}
            footer={
              <>
                Ainda não tem conta? <TextLink href="#criar-conta">Criar conta</TextLink>
              </>
            }
          >
            <Button width="full">Entrar</Button>
          </AuthLayout>
        </div>
      ),
    },
  ],
}
