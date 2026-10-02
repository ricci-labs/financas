import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export type BannerProps = {
  icon: LucideIcon
  children: ReactNode
  action?: ReactNode
}
