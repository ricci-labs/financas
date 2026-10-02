import { Tip } from '@web/components/feedback/tip/tip'
import type { ComponentExamples } from '@web/lib/examples.types'

export const tipExamples: ComponentExamples = {
  component: 'Tip',
  examples: [
    {
      name: 'Sobre a página',
      render: () => (
        <div className="text-ink-muted">
          <Tip>Não chegou? Olhe o spam e a aba Promoções.</Tip>
        </div>
      ),
    },
    {
      name: 'Sobre a menta',
      render: () => (
        <div className="rounded-lg bg-mint p-3.5 text-on-mint">
          <Tip>Não chegou? Olhe o spam e a aba Promoções.</Tip>
        </div>
      ),
    },
  ],
}
