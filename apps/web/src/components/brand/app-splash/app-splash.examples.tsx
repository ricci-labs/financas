import { AppSplash } from '@web/components/brand/app-splash/app-splash'
import type { ComponentExamples } from '@web/lib/examples.types'

export const appSplashExamples: ComponentExamples = {
  component: 'AppSplash',
  examples: [
    {
      name: 'Abrindo',
      render: () => (
        <div className="w-full overflow-hidden rounded-lg">
          <AppSplash isSlow={false} className="min-h-150" />
        </div>
      ),
    },
    {
      name: 'Demorando',
      render: () => (
        <div className="w-full overflow-hidden rounded-lg">
          <AppSplash isSlow className="min-h-150" />
        </div>
      ),
    },
  ],
}
