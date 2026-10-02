import { NextStepCard } from '@web/components/display/next-step-card/next-step-card'
import type { ComponentExamples } from '@web/lib/examples.types'

export const nextStepCardExamples: ComponentExamples = {
  component: 'NextStepCard',
  examples: [
    {
      name: 'Depois de confirmar',
      render: () => (
        <div className="max-w-100 rounded-lg bg-mint p-4">
          <NextStepCard>
            Depois de entrar, vocês montam o espaço do casal e já veem quanto ainda podem gastar no
            mês.
          </NextStepCard>
        </div>
      ),
    },
  ],
}
