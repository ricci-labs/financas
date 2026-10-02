import { OWL_SCENE_NAMES, OwlScene } from '@web/components/brand/owl-scene/owl-scene'
import type { ComponentExamples } from '@web/lib/examples.types'

export const owlSceneExamples: ComponentExamples = {
  component: 'OwlScene',
  examples: OWL_SCENE_NAMES.map((scene) => ({
    name: scene,
    render: () => (
      <div className="h-40 w-48 rounded-lg bg-mint">
        <OwlScene scene={scene} />
      </div>
    ),
  })),
}
