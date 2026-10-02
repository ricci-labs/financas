import type { OwlSceneName } from '@web/components/brand/owl-scene'

export type OwlEntranceProps = {
  scene: OwlSceneName
  isOncePerSession?: boolean
  isStill?: boolean
  className?: string
}
