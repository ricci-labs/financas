import type { OwlEntranceProps } from '@web/components/brand/owl-entrance/owl-entrance.types'
import { OwlKit, type OwlKitName } from '@web/components/brand/owl-kit'
import { OwlScene, type OwlSceneName } from '@web/components/brand/owl-scene'
import { useEffect, useState } from 'react'

const ENTRANCES: Readonly<Partial<Record<OwlSceneName, OwlKitName>>> = {
  welcome: 'entrance-welcome',
  signUp: 'entrance-sign-up',
  key: 'entrance-key',
  offline: 'entrance-offline',
  wait: 'entrance-wait',
  linkExpired: 'entrance-link-expired',
  invitation: 'entrance-invitation',
  together: 'entrance-together',
  envelope: 'entrance-envelope',
}

const playedThisSession = new Set<OwlSceneName>()

export function OwlEntrance({
  scene,
  isOncePerSession = false,
  isStill = false,
  className,
}: OwlEntranceProps) {
  const [openingScene] = useState(scene)
  const [isFirstOpening] = useState(() => !playedThisSession.has(scene))

  useEffect(() => {
    playedThisSession.add(openingScene)
  }, [openingScene])

  const kit = ENTRANCES[scene]
  const hasChanged = scene !== openingScene
  const plays = !isStill && (hasChanged || !isOncePerSession || isFirstOpening)
  if (!kit || !plays) {
    return <OwlScene scene={scene} className={className} />
  }
  return <OwlKit key={scene} kit={kit} scene={scene} hidesStillWhileLoading className={className} />
}
