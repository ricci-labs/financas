import { Banner } from '@web/components/feedback/banner'
import { useIsOnline } from '@web/hooks/use-is-online'
import { NETWORK_ERROR_MESSAGE } from '@web/lib/errors/errors.messages'
import { WifiOff } from 'lucide-react'

export function OfflineBanner() {
  const isOnline = useIsOnline()
  if (isOnline) {
    return null
  }
  return <Banner icon={WifiOff}>{NETWORK_ERROR_MESSAGE}</Banner>
}
