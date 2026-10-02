import type { textLinkVariants } from '@web/components/actions/text-link/text-link.variants'
import type { VariantProps } from 'class-variance-authority'
import type { ComponentProps, ReactElement } from 'react'

export type TextLinkProps = ComponentProps<'a'> &
  VariantProps<typeof textLinkVariants> & {
    render?: ReactElement
  }
