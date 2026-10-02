import { Divider } from '@web/components/display/divider/divider'
import type { ComponentExamples } from '@web/lib/examples.types'

export const dividerExamples: ComponentExamples = {
  component: 'Divider',
  examples: [
    {
      name: 'Sobre a página',
      render: () => <Divider>Ainda não confirmou?</Divider>,
    },
    {
      name: 'Sobre o papel',
      render: () => (
        <div className="rounded-lg bg-sketch-paper p-4">
          <Divider surface="paper">Ainda não confirmou?</Divider>
        </div>
      ),
    },
  ],
}
