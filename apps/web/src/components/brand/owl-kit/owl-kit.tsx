import type {
  OwlKitName,
  OwlKitProps,
  OwlKitStills,
} from '@web/components/brand/owl-kit/owl-kit.types'
import {
  owlKitDrawingVariants,
  owlKitVariants,
} from '@web/components/brand/owl-kit/owl-kit.variants'
import { OwlScene } from '@web/components/brand/owl-scene'
import { cn } from '@web/lib/cn'
import { useLayoutEffect, useRef, useState } from 'react'

const KIT_FILES = import.meta.glob<string>('/src/assets/owl-kits/*.svg', {
  query: '?raw',
  import: 'default',
})
const KIT_FOLDER = '/src/assets/owl-kits/'
const BOTTOM_ALIGNED = 'xMidYMax meet'

const loaded = new Map<OwlKitName, string>()
const loading = new Map<OwlKitName, Promise<string>>()

export const OWL_KIT_STILLS: Readonly<Record<OwlKitName, OwlKitStills>> = {
  confirm: { before: 'wait', after: 'confirmed' },
  'confirm-expired': { before: 'wait', after: 'linkExpired' },
  invitation: { before: 'invitation', after: 'together' },
  'sign-up-sent': { before: 'envelope', after: 'envelope' },
  'forgot-sent': { before: 'envelope', after: 'envelope' },
  'reset-expired': { before: 'linkExpired', after: 'linkExpired' },
  closed: { before: 'closed', after: 'closed' },
  'entrance-welcome': { before: 'welcome', after: 'welcome' },
  'entrance-sign-up': { before: 'signUp', after: 'signUp' },
  'entrance-key': { before: 'key', after: 'key' },
  'entrance-offline': { before: 'offline', after: 'offline' },
  'entrance-wait': { before: 'wait', after: 'wait' },
  'entrance-link-expired': { before: 'linkExpired', after: 'linkExpired' },
  'entrance-invitation': { before: 'invitation', after: 'invitation' },
  'entrance-together': { before: 'together', after: 'together' },
  'entrance-envelope': { before: 'envelope', after: 'envelope' },
}

export function loadedOwlKit(kit: OwlKitName): string | undefined {
  return loaded.get(kit)
}

export function loadOwlKit(kit: OwlKitName): Promise<string> {
  const pending = loading.get(kit)
  if (pending) {
    return pending
  }
  const load = KIT_FILES[`${KIT_FOLDER}${kit}.svg`]
  if (!load) {
    return Promise.reject(new Error(`Unknown owl kit ${kit}`))
  }
  const request = load().then((source) => {
    loaded.set(kit, source)
    return source
  })
  loading.set(kit, request)
  return request
}

export function preloadOwlKits(kits: readonly OwlKitName[]): void {
  for (const kit of kits) {
    void loadOwlKit(kit).catch(() => undefined)
  }
}

export function drawingOf(source: string): SVGSVGElement {
  const parsed = new DOMParser().parseFromString(source, 'image/svg+xml').documentElement
  const drawing = document.importNode(parsed, true) as unknown as SVGSVGElement
  drawing.removeAttribute('width')
  drawing.removeAttribute('height')
  drawing.setAttribute('preserveAspectRatio', BOTTOM_ALIGNED)
  drawing.setAttribute('focusable', 'false')
  return drawing
}

export function OwlKit({
  kit,
  phase = 'after',
  scene,
  hidesStillWhileLoading = false,
  className,
}: OwlKitProps) {
  const host = useRef<HTMLDivElement>(null)
  const [drawnKit, setDrawnKit] = useState<OwlKitName | null>(null)
  const isReady = drawnKit === kit

  useLayoutEffect(() => {
    let isCurrent = true
    const draw = (source: string) => {
      if (isCurrent && host.current) {
        host.current.replaceChildren(drawingOf(source))
        setDrawnKit(kit)
      }
    }
    const source = loadedOwlKit(kit)
    if (source) {
      draw(source)
    } else {
      void loadOwlKit(kit).then(draw, () => undefined)
    }
    return () => {
      isCurrent = false
    }
  }, [kit])

  return (
    <div
      data-slot="owl-kit"
      data-owl-kit={kit}
      data-phase={phase}
      data-scene={scene}
      aria-hidden="true"
      className={cn(owlKitVariants(), className)}
    >
      {!isReady && !hidesStillWhileLoading && <OwlScene scene={OWL_KIT_STILLS[kit][phase]} />}
      <div ref={host} className={owlKitDrawingVariants({ isReady })} />
    </div>
  )
}
