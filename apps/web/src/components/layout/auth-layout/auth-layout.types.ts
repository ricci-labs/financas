import type { OwlSceneName } from '@web/components/brand/owl-scene'
import type { ReactNode } from 'react'

export type AuthLayoutProps = {
  scene: OwlSceneName
  title: string
  subtitle: string
  banner?: ReactNode
  notice?: ReactNode
  footer?: ReactNode
  children: ReactNode
  className?: string
}
