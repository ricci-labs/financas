import { createFileRoute } from '@tanstack/react-router'
import { VerifyEmailPage } from '@web/features/auth'

export const Route = createFileRoute('/verify-email')({
  component: VerifyEmailPage,
})
