import type { NextStepCardProps } from '@web/components/display/next-step-card/next-step-card.types'
import { nextStepCardVariants } from '@web/components/display/next-step-card/next-step-card.variants'
import { Sparkle } from 'lucide-react'

export function NextStepCard({ children }: NextStepCardProps) {
  return (
    <p data-slot="next-step-card" className={nextStepCardVariants()}>
      <Sparkle aria-hidden="true" />
      {children}
    </p>
  )
}
