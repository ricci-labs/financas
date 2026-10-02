import { Spinner } from '@web/components/feedback/spinner/spinner'
import type { ComponentExamples } from '@web/lib/examples.types'

export const spinnerExamples: ComponentExamples = {
  component: 'Spinner',
  examples: [
    {
      name: 'Tamanhos',
      render: () => (
        <div className="flex items-center gap-4 text-ink">
          <Spinner size="sm" />
          <Spinner size="md" />
          <Spinner size="lg" />
        </div>
      ),
    },
  ],
}
