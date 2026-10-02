import { ApiStatusBadge } from '@web/features/system-status/components/api-status-badge'
import { systemStatusMessages } from '@web/features/system-status/system-status.messages'
import type { StatusPageProps } from '@web/features/system-status/system-status.types'
import { usePageTitle } from '@web/hooks/use-page-title'

export function StatusPage({ action }: StatusPageProps) {
  usePageTitle(systemStatusMessages.pageTitle)
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-page px-6">
      <div className="text-center">
        <h1 className="font-display text-display text-ink">{systemStatusMessages.productName}</h1>
        <p className="mt-2 text-ink-muted">{systemStatusMessages.slogan}</p>
      </div>
      <ApiStatusBadge />
      {action}
    </main>
  )
}
