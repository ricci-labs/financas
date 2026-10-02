import { createFileRoute } from '@tanstack/react-router'
import { InvitationPage, loadSession } from '@web/features/auth'

export const Route = createFileRoute('/invite')({
  loader: ({ context }) => loadSession(context.queryClient),
  component: InvitationPage,
})
