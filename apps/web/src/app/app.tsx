import { ApiStatusBadge } from '@web/features/system-status'

export function App() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-page px-6">
      <div className="text-center">
        <h1 className="font-display text-display text-ink">Twise</h1>
        <p className="mt-2 text-ink-muted">Leve, claro, a dois.</p>
      </div>
      <ApiStatusBadge />
    </main>
  )
}
