import { TextLink } from '@web/components/actions/text-link/text-link'
import type { ComponentExamples } from '@web/lib/examples.types'

export const textLinkExamples: ComponentExamples = {
  component: 'TextLink',
  examples: [
    { name: 'Marca', render: () => <TextLink href="#criar-conta">Criar conta</TextLink> },
    {
      name: 'Na frase',
      render: () => (
        <p className="text-body-sm text-ink-muted">
          Ainda não tem conta? <TextLink href="#criar-conta">Criar conta</TextLink>
        </p>
      ),
    },
    {
      name: 'Herdando a cor',
      render: () => (
        <TextLink tone="inherit" href="#entrar">
          Entre com ela
        </TextLink>
      ),
    },
  ],
}
