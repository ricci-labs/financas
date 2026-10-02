import type { OwlSceneName } from '@web/components/brand/owl-scene'

export type OwlKitName =
  | 'confirm'
  | 'confirm-expired'
  | 'invitation'
  | 'sign-up-sent'
  | 'forgot-sent'
  | 'reset-expired'
  | 'closed'
  | 'entrance-welcome'
  | 'entrance-sign-up'
  | 'entrance-key'
  | 'entrance-offline'
  | 'entrance-wait'
  | 'entrance-link-expired'
  | 'entrance-invitation'
  | 'entrance-together'
  | 'entrance-envelope'

export type OwlKitPhase = 'before' | 'after'

export type OwlKitProps = {
  kit: OwlKitName
  phase?: OwlKitPhase
  scene?: OwlSceneName
  hidesStillWhileLoading?: boolean
  className?: string
}

export type OwlKitStills = Readonly<Record<OwlKitPhase, OwlSceneName>>
