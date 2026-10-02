import { Logo } from '@web/components/brand/logo'
import { OwlEntrance } from '@web/components/brand/owl-entrance'
import { authLayoutMessages } from '@web/components/layout/auth-layout/auth-layout.messages'
import type { AuthLayoutProps } from '@web/components/layout/auth-layout/auth-layout.types'
import {
  authArtVariants,
  authClaimVariants,
  authColumnVariants,
  authFooterVariants,
  authGridVariants,
  authLayoutVariants,
  authMainVariants,
  authOwlVariants,
  authSubtitleVariants,
  authTitleVariants,
} from '@web/components/layout/auth-layout/auth-layout.variants'
import { useLightTheme } from '@web/hooks/use-light-theme'
import { cn } from '@web/lib/cn'

export function AuthLayout({
  scene,
  title,
  subtitle,
  banner,
  notice,
  footer,
  children,
  className,
}: AuthLayoutProps) {
  useLightTheme()
  return (
    <div data-slot="auth-layout" className={cn(authLayoutVariants(), className)}>
      {banner}
      <div className={authGridVariants()}>
        <div className={authArtVariants()}>
          <Logo className="hidden lg:block lg:self-start" />
          <OwlEntrance scene={scene} isOncePerSession className={authOwlVariants()} />
          <div className={authClaimVariants()}>
            <p className="font-display text-claim">{authLayoutMessages.claim}</p>
            <p className="text-claim-support">{authLayoutMessages.support}</p>
          </div>
        </div>
        <main className={authMainVariants()}>
          <div className={authColumnVariants()}>
            <header>
              <h1 className={authTitleVariants()}>{title}</h1>
              <p className={authSubtitleVariants()}>{subtitle}</p>
            </header>
            {notice}
            {children}
            {footer && <p className={authFooterVariants()}>{footer}</p>}
          </div>
        </main>
      </div>
    </div>
  )
}
