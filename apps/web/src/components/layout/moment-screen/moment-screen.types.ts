import type { OwlSceneName } from '@web/components/brand/owl-scene'
import type { momentVariants } from '@web/components/layout/moment-screen/moment-screen.variants'
import type { VariantProps } from 'class-variance-authority'
import type { ReactNode } from 'react'

export type MomentTone = NonNullable<VariantProps<typeof momentVariants>['tone']>

export type MomentScreenProps = {
  tone: MomentTone
  scene: OwlSceneName
  title: string
  children?: ReactNode
  actions?: ReactNode
  banner?: ReactNode
  className?: string
}
