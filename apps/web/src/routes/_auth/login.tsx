import { createFileRoute, redirect } from '@tanstack/react-router'
import { LoginPage, loadSession, loginSearchSchema } from '@web/features/auth'
import { appPathOrHome } from '@web/lib/navigation'

export const Route = createFileRoute('/_auth/login')({
  validateSearch: loginSearchSchema,
  beforeLoad: async ({ context, search }) => {
    const account = await loadSession(context.queryClient)
    if (account) {
      throw redirect({ href: appPathOrHome(search.next) })
    }
  },
  component: LoginPage,
})
