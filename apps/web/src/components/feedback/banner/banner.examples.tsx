import { Button } from '@web/components/actions/button'
import { Banner } from '@web/components/feedback/banner/banner'
import type { ComponentExamples } from '@web/lib/examples.types'
import { Eye, RefreshCw, WifiOff } from 'lucide-react'

export const bannerExamples: ComponentExamples = {
  component: 'Banner',
  examples: [
    {
      name: 'Sem conexão',
      render: () => (
        <Banner icon={WifiOff}>Sem conexão. Verifique a internet e tente de novo.</Banner>
      ),
    },
    {
      name: 'Somente leitura',
      render: () => <Banner icon={Eye}>Você está vendo este espaço sem poder alterar nada.</Banner>,
    },
    {
      name: 'Com ação',
      render: () => (
        <Banner
          icon={RefreshCw}
          action={
            <Button variant="outline" size="sm">
              Atualizar
            </Button>
          }
        >
          Nova versão disponível
        </Banner>
      ),
    },
  ],
}
