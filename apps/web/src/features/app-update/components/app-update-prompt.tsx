import { useRegisterSW } from 'virtual:pwa-register/react'
import { showToast } from '@web/components/feedback/toast'
import { appUpdateMessages } from '@web/features/app-update/app-update.messages'
import { useEffect } from 'react'

export function AppUpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  useEffect(() => {
    if (!needRefresh) {
      return
    }
    showToast(appUpdateMessages.available, {
      isPersistent: true,
      action: { label: appUpdateMessages.update, onPress: () => void updateServiceWorker(true) },
    })
  }, [needRefresh, updateServiceWorker])

  return null
}
