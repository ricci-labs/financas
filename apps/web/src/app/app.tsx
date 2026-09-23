import { ApiStatusBadge } from '@web/features/system-status'

export function App() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-slate-50 px-6">
      <div className="text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900">financas</h1>
        <p className="mt-2 text-slate-600">Quanto ainda podemos gastar?</p>
      </div>
      <ApiStatusBadge />
    </main>
  )
}
