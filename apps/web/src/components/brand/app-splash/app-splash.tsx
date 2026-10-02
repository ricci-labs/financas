import owlSource from '@web/assets/brand/owl.svg?raw'
import { appSplashMessages } from '@web/components/brand/app-splash/app-splash.messages'
import type { AppSplashProps } from '@web/components/brand/app-splash/app-splash.types'
import {
  appSplashOwlVariants,
  appSplashSlowVariants,
  appSplashVariants,
} from '@web/components/brand/app-splash/app-splash.variants'
import { drawingOf } from '@web/components/brand/owl-kit'
import { Spinner } from '@web/components/feedback/spinner'
import { useLightTheme } from '@web/hooks/use-light-theme'
import { cn } from '@web/lib/cn'
import { useLayoutEffect, useRef } from 'react'

export function AppSplash({ isSlow, className }: AppSplashProps) {
  const owl = useRef<HTMLDivElement>(null)
  useLightTheme()

  useLayoutEffect(() => {
    owl.current?.replaceChildren(drawingOf(owlSource))
  }, [])

  return (
    <main data-slot="app-splash" aria-busy="true" className={cn(appSplashVariants(), className)}>
      <div ref={owl} aria-hidden="true" className={appSplashOwlVariants()} />
      <p data-splash="name" className="font-display text-brand">
        {appSplashMessages.name}
      </p>
      <p data-splash="slogan" className="text-slogan">
        {appSplashMessages.slogan}
      </p>
      <p className={appSplashSlowVariants()} role="status">
        {isSlow && (
          <>
            <Spinner />
            {appSplashMessages.opening}
          </>
        )}
      </p>
    </main>
  )
}
