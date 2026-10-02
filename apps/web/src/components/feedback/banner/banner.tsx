import type { BannerProps } from '@web/components/feedback/banner/banner.types'
import { bannerVariants } from '@web/components/feedback/banner/banner.variants'

export function Banner({ icon: Icon, children }: BannerProps) {
  return (
    <div data-slot="banner" role="status" className={bannerVariants()}>
      <Icon aria-hidden="true" />
      {children}
    </div>
  )
}
