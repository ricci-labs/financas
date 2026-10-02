import closed from '@web/assets/owls/closed.svg'
import confirmed from '@web/assets/owls/confirmed.svg'
import envelope from '@web/assets/owls/envelope.svg'
import invitation from '@web/assets/owls/invitation.svg'
import key from '@web/assets/owls/key.svg'
import linkExpired from '@web/assets/owls/link-expired.svg'
import offline from '@web/assets/owls/offline.svg'
import signUp from '@web/assets/owls/sign-up.svg'
import together from '@web/assets/owls/together.svg'
import wait from '@web/assets/owls/wait.svg'
import welcome from '@web/assets/owls/welcome.svg'
import type { OwlSceneName, OwlSceneProps } from '@web/components/brand/owl-scene/owl-scene.types'
import { owlSceneVariants } from '@web/components/brand/owl-scene/owl-scene.variants'
import { cn } from '@web/lib/cn'

const OWL_SCENES: Readonly<Record<OwlSceneName, string>> = {
  welcome,
  wait,
  envelope,
  offline,
  signUp,
  confirmed,
  key,
  linkExpired,
  closed,
  invitation,
  together,
}

export const OWL_SCENE_NAMES = Object.keys(OWL_SCENES) as OwlSceneName[]

export function OwlScene({ scene, className }: OwlSceneProps) {
  return (
    <img
      data-slot="owl-scene"
      data-scene={scene}
      src={OWL_SCENES[scene]}
      alt=""
      draggable={false}
      className={cn(owlSceneVariants(), className)}
    />
  )
}
