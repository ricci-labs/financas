import { useApiStatus } from '@web/features/system-status/api/use-api-status'
import type { ApiStatus } from '@web/features/system-status/system-status.types'

const BADGE_STYLES: Record<ApiStatus['state'], string> = {
  checking: 'bg-muted text-muted-foreground',
  online: 'bg-success-muted text-success',
  offline: 'bg-danger-muted text-danger',
}

function describe(status: ApiStatus): string {
  switch (status.state) {
    case 'checking':
      return 'Verificando API…'
    case 'online':
      return `API online · ${status.version}`
    case 'offline':
      return 'API offline'
  }
}

export function ApiStatusBadge() {
  const status = useApiStatus()

  return (
    <span className={`rounded-full px-3 py-1 text-sm font-medium ${BADGE_STYLES[status.state]}`}>
      {describe(status)}
    </span>
  )
}
