import owl from '@web/assets/brand/owl.svg'
import { appSplashMessages } from '@web/components/brand/app-splash/app-splash.messages'
import type { AppSplashProps } from '@web/components/brand/app-splash/app-splash.types'
import {
  appSplashOwlVariants,
  appSplashSlowVariants,
  appSplashSpinnerVariants,
  appSplashVariants,
} from '@web/components/brand/app-splash/app-splash.variants'
import { useLightTheme } from '@web/hooks/use-light-theme'
import { cn } from '@web/lib/cn'

export function AppSplash({ isSlow, className }: AppSplashProps) {
  useLightTheme()
  return (
    <main data-slot="app-splash" aria-busy="true" className={cn(appSplashVariants(), className)}>
      <img src={owl} alt="" draggable={false} className={appSplashOwlVariants()} />
      <p className="font-display text-brand">{appSplashMessages.name}</p>
      <p className="text-slogan">{appSplashMessages.slogan}</p>
      <p className={appSplashSlowVariants()} role="status">
        {isSlow && (
          <>
            <span aria-hidden="true" className={appSplashSpinnerVariants()} />
            {appSplashMessages.opening}
          </>
        )}
      </p>
    </main>
  )
}
