import { createFileRoute, redirect } from '@tanstack/react-router'
import { authConfigQueryOptions, loadSession, SignUpPage } from '@web/features/auth'

export const Route = createFileRoute('/_auth/signup')({
  beforeLoad: async ({ context }) => {
    if (await loadSession(context.queryClient)) {
      throw redirect({ to: '/' })
    }
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(authConfigQueryOptions()),
  component: SignUpPage,
})
