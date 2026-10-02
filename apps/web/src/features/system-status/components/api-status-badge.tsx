import { useApiStatus } from '@web/features/system-status/api/use-api-status'
import { systemStatusMessages } from '@web/features/system-status/system-status.messages'
import type { ApiStatus } from '@web/features/system-status/system-status.types'

const BADGE_STYLES: Record<ApiStatus['state'], string> = {
  checking: 'bg-sunken text-ink-muted',
  online: 'bg-success-soft text-success',
  offline: 'bg-danger-soft text-danger',
}

function describe(status: ApiStatus): string {
  switch (status.state) {
    case 'checking':
      return systemStatusMessages.checking
    case 'online':
      return systemStatusMessages.online(status.version)
    case 'offline':
      return systemStatusMessages.offline
  }
}

export function ApiStatusBadge() {
  const status = useApiStatus()

  return (
    <span className={`rounded-full px-3 py-1 text-label ${BADGE_STYLES[status.state]}`}>
      {describe(status)}
    </span>
  )
}
