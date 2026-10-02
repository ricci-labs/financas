import type { dividerVariants } from '@web/components/display/divider/divider.variants'
import type { VariantProps } from 'class-variance-authority'
import type { ReactNode } from 'react'

export type DividerProps = VariantProps<typeof dividerVariants> & {
  children: ReactNode
}
