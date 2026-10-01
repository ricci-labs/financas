import { ApiStatusBadge } from '@web/features/system-status'

export function App() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-6">
      <div className="text-center">
        <h1 className="text-display font-semibold text-foreground">Twise</h1>
        <p className="mt-2 text-muted-foreground">Leve, claro, a dois.</p>
      </div>
      <ApiStatusBadge />
    </main>
  )
}
