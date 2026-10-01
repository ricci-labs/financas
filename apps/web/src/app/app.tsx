import { appMessages } from '@web/app/app.messages'
import { ApiStatusBadge } from '@web/features/system-status'

export function App() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-page px-6">
      <div className="text-center">
        <h1 className="font-display text-display text-ink">{appMessages.productName}</h1>
        <p className="mt-2 text-ink-muted">{appMessages.slogan}</p>
      </div>
      <ApiStatusBadge />
    </main>
  )
}
