import type { BannerProps } from '@web/components/feedback/banner/banner.types'
import { bannerTextVariants, bannerVariants } from '@web/components/feedback/banner/banner.variants'

export function Banner({ icon: Icon, children, action }: BannerProps) {
  return (
    <div data-slot="banner" role="status" className={bannerVariants()}>
      <Icon aria-hidden="true" />
      <span className={bannerTextVariants()}>{children}</span>
      {action}
    </div>
  )
}
