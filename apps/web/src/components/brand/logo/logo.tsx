import icon from '@web/assets/brand/icon.svg'
import logo from '@web/assets/brand/logo.svg'
import { logoMessages } from '@web/components/brand/logo/logo.messages'
import type { LogoProps } from '@web/components/brand/logo/logo.types'
import { logoVariants } from '@web/components/brand/logo/logo.variants'
import { cn } from '@web/lib/cn'

export function Logo({ variant = 'full', className }: LogoProps) {
  return (
    <img
      data-slot="logo"
      src={variant === 'full' ? logo : icon}
      alt={logoMessages.name}
      draggable={false}
      className={cn(logoVariants({ variant }), className)}
    />
  )
}
