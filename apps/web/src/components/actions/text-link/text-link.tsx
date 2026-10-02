import { useRender } from '@base-ui/react/use-render'
import type { TextLinkProps } from '@web/components/actions/text-link/text-link.types'
import { textLinkVariants } from '@web/components/actions/text-link/text-link.variants'
import { cn } from '@web/lib/cn'

export function TextLink({ render, tone, className, ...props }: TextLinkProps) {
  return useRender({
    render,
    defaultTagName: 'a',
    props: {
      ...props,
      'data-slot': 'text-link',
      className: cn(textLinkVariants({ tone }), className),
    },
  })
}
