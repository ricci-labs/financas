import { Logo } from '@web/components/brand/logo/logo'
import type { ComponentExamples } from '@web/lib/examples.types'

export const logoExamples: ComponentExamples = {
  component: 'Logo',
  examples: [
    { name: 'Completo', render: () => <Logo /> },
    { name: 'Ícone', render: () => <Logo variant="icon" /> },
    {
      name: 'Sobre a menta',
      render: () => (
        <div className="rounded-lg bg-mint p-4">
          <Logo />
        </div>
      ),
    },
  ],
}
