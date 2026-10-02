import { OwlEntrance } from '@web/components/brand/owl-entrance'
import { OwlKit } from '@web/components/brand/owl-kit'
import type { MomentScreenProps } from '@web/components/layout/moment-screen/moment-screen.types'
import {
  momentActionsVariants,
  momentArtVariants,
  momentBannerVariants,
  momentBodyVariants,
  momentOwlVariants,
  momentTextVariants,
  momentTitleVariants,
  momentVariants,
} from '@web/components/layout/moment-screen/moment-screen.variants'
import { useLightTheme } from '@web/hooks/use-light-theme'
import { cn } from '@web/lib/cn'

export function MomentScreen({
  tone,
  scene,
  kit,
  isStill,
  title,
  children,
  actions,
  banner,
  className,
}: MomentScreenProps) {
  useLightTheme()
  return (
    <main
      data-slot="moment-screen"
      data-tone={tone}
      className={cn(momentVariants({ tone }), className)}
    >
      {banner && <div className={momentBannerVariants()}>{banner}</div>}
      <div className={momentArtVariants()}>
        {kit ? (
          <OwlKit {...kit} className={momentOwlVariants()} />
        ) : (
          <OwlEntrance scene={scene} isStill={isStill} className={momentOwlVariants()} />
        )}
      </div>
      <div className={momentBodyVariants()} aria-live="polite">
        <div key={title} className={momentTextVariants()}>
          <h1 className={momentTitleVariants()}>{title}</h1>
          {children}
        </div>
      </div>
      {actions && (
        <div key={title} className={momentActionsVariants()}>
          {actions}
        </div>
      )}
    </main>
  )
}
