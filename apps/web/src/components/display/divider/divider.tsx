import type { DividerProps } from '@web/components/display/divider/divider.types'
import { dividerVariants } from '@web/components/display/divider/divider.variants'

export function Divider({ surface, children }: DividerProps) {
  return (
    <p data-slot="divider" className={dividerVariants({ surface })}>
      {children}
    </p>
  )
}
