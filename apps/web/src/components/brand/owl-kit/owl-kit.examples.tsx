import { OwlKit } from '@web/components/brand/owl-kit/owl-kit'
import type { OwlKitName } from '@web/components/brand/owl-kit/owl-kit.types'
import type { ComponentExamples } from '@web/lib/examples.types'

const ARRIVALS: readonly OwlKitName[] = ['sign-up-sent', 'forgot-sent', 'reset-expired', 'closed']
const EVENTS: readonly OwlKitName[] = ['confirm', 'confirm-expired', 'invitation']

export const owlKitExamples: ComponentExamples = {
  component: 'OwlKit',
  examples: [
    ...ARRIVALS.map((kit) => ({
      name: `Chegada · ${kit}`,
      render: () => (
        <div className="h-60 w-72 rounded-lg bg-mint">
          <OwlKit kit={kit} />
        </div>
      ),
    })),
    ...EVENTS.flatMap((kit) =>
      (['before', 'after'] as const).map((phase) => ({
        name: `${kit} · ${phase === 'before' ? 'antes' : 'depois'}`,
        render: () => (
          <div className="h-60 w-72 rounded-lg bg-mint">
            <OwlKit kit={kit} phase={phase} />
          </div>
        ),
      })),
    ),
  ],
}
