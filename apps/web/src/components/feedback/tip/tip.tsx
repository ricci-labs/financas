import type { TipProps } from '@web/components/feedback/tip/tip.types'
import { tipVariants } from '@web/components/feedback/tip/tip.variants'
import { Info } from 'lucide-react'

export function Tip({ children }: TipProps) {
  return (
    <p data-slot="tip" className={tipVariants()}>
      <Info aria-hidden="true" />
      {children}
    </p>
  )
}
