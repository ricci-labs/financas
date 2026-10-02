import { Button } from '@web/components/actions/button/button'
import type { ComponentExamples } from '@web/lib/examples.types'
import { formatMinutesAndSeconds, formatSeconds } from '@web/lib/format/countdown'
import { ArrowRight } from 'lucide-react'

const ONE_MINUTE_MS = 60_000
const FORTY_MINUTES_MS = 40 * ONE_MINUTE_MS

export const buttonExamples: ComponentExamples = {
  component: 'Button',
  examples: [
    { name: 'Primária', render: () => <Button>Salvar lançamento</Button> },
    { name: 'Secundária', render: () => <Button variant="secondary">Cancelar</Button> },
    { name: 'Contorno', render: () => <Button variant="outline">Já tenho conta</Button> },
    { name: 'Terciária', render: () => <Button variant="tertiary">Esqueci minha senha</Button> },
    { name: 'Perigo', render: () => <Button variant="danger">Remover membro</Button> },
    {
      name: 'Com ícone',
      render: () => (
        <Button>
          Entrar
          <ArrowRight aria-hidden="true" />
        </Button>
      ),
    },
    { name: 'Pequeno', render: () => <Button size="sm">Reenviar e-mail de confirmação</Button> },
    { name: 'Largura total', render: () => <Button width="full">Entrar</Button> },
    { name: 'Desativado', render: () => <Button isDisabled>Entrar</Button> },
    {
      name: 'Carregando',
      render: () => (
        <Button isLoading loadingLabel="Entrando…" width="full">
          Entrar
        </Button>
      ),
    },
    {
      name: 'Esperando (reenviar)',
      render: () => (
        <Button
          variant="secondary"
          waitUntil={Date.now() + ONE_MINUTE_MS}
          waitLabel={(seconds) => `Reenviar em ${formatSeconds(seconds)}`}
        >
          Reenviar e-mail
        </Button>
      ),
    },
    {
      name: 'Esperando (limite)',
      render: () => (
        <Button
          width="full"
          waitUntil={Date.now() + FORTY_MINUTES_MS}
          waitLabel={(seconds) => `Tente de novo em ${formatMinutesAndSeconds(seconds)}`}
        >
          Entrar
        </Button>
      ),
    },
  ],
}
