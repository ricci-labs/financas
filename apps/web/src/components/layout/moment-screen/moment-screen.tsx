import { OwlScene } from '@web/components/brand/owl-scene'
import type { MomentScreenProps } from '@web/components/layout/moment-screen/moment-screen.types'
import {
  momentActionsVariants,
  momentArtVariants,
  momentBannerVariants,
  momentBodyVariants,
  momentOwlVariants,
  momentTitleVariants,
  momentVariants,
} from '@web/components/layout/moment-screen/moment-screen.variants'
import { useLightTheme } from '@web/hooks/use-light-theme'
import { cn } from '@web/lib/cn'

export function MomentScreen({
  tone,
  scene,
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
        <OwlScene scene={scene} className={momentOwlVariants()} />
      </div>
      <div className={momentBodyVariants()} aria-live="polite">
        <h1 className={momentTitleVariants()}>{title}</h1>
        {children}
      </div>
      {actions && <div className={momentActionsVariants()}>{actions}</div>}
    </main>
  )
}
