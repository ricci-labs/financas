import { OwlEntrance } from '@web/components/brand/owl-entrance/owl-entrance'
import type { OwlSceneName } from '@web/components/brand/owl-scene'
import type { ComponentExamples } from '@web/lib/examples.types'

const SCENES: readonly OwlSceneName[] = [
  'welcome',
  'signUp',
  'key',
  'offline',
  'wait',
  'linkExpired',
  'invitation',
  'together',
  'envelope',
]

export const owlEntranceExamples: ComponentExamples = {
  component: 'OwlEntrance',
  examples: SCENES.map((scene) => ({
    name: `Entrada · ${scene}`,
    render: () => (
      <div className="h-60 w-72 rounded-lg bg-mint">
        <OwlEntrance scene={scene} />
      </div>
    ),
  })),
}
