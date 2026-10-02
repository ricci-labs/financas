import { authMessages } from '@web/features/auth/auth.messages'

export function LoginPage() {
  return (
    <main className="flex min-h-dvh flex-col justify-center gap-2 bg-page px-4">
      <h1 className="font-display text-display text-ink">{authMessages.login.title}</h1>
      <p className="text-body-sm text-ink-muted">{authMessages.login.subtitle}</p>
    </main>
  )
}
