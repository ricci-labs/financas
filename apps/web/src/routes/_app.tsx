import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { AppOpening, loadSession } from '@web/features/auth'

export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context, location }) => {
    const account = await loadSession(context.queryClient)
    if (!account) {
      throw redirect({ to: '/login', search: { next: location.href } })
    }
    return { account }
  },
  pendingComponent: AppOpening,
  pendingMs: 0,
  pendingMinMs: 0,
  component: Outlet,
})
