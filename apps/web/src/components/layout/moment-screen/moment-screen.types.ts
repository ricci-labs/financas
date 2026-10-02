import type { OwlKitProps } from '@web/components/brand/owl-kit'
import type { OwlSceneName } from '@web/components/brand/owl-scene'
import type { momentVariants } from '@web/components/layout/moment-screen/moment-screen.variants'
import type { VariantProps } from 'class-variance-authority'
import type { ReactNode } from 'react'

export type MomentTone = NonNullable<VariantProps<typeof momentVariants>['tone']>

export type MomentOwl = { scene: OwlSceneName; kit?: never } | { kit: OwlKitProps; scene?: never }

export type MomentScreenProps = MomentOwl & {
  tone: MomentTone
  title: string
  children?: ReactNode
  actions?: ReactNode
  banner?: ReactNode
  className?: string
}
