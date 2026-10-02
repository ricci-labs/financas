import type { OwlSceneName } from '@web/components/brand/owl-scene'

export type OwlKitName =
  | 'confirm'
  | 'confirm-expired'
  | 'invitation'
  | 'sign-up-sent'
  | 'forgot-sent'
  | 'reset-expired'
  | 'closed'

export type OwlKitPhase = 'before' | 'after'

export type OwlKitProps = {
  kit: OwlKitName
  phase?: OwlKitPhase
  className?: string
}

export type OwlKitStills = Readonly<Record<OwlKitPhase, OwlSceneName>>
