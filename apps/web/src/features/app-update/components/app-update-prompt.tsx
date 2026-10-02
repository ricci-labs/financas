import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '@web/components/actions/button'
import { Banner } from '@web/components/feedback/banner'
import { appUpdateMessages } from '@web/features/app-update/app-update.messages'
import { RefreshCw } from 'lucide-react'

export function AppUpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) {
    return null
  }
  return (
    <div data-slot="app-update" className="fixed inset-x-0 top-0 z-toast">
      <Banner
        icon={RefreshCw}
        action={
          <Button variant="outline" size="sm" onClick={() => void updateServiceWorker(true)}>
            {appUpdateMessages.update}
          </Button>
        }
      >
        {appUpdateMessages.available}
      </Banner>
    </div>
  )
}
