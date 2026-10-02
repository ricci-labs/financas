import { createFileRoute } from '@tanstack/react-router'
import { ResetPasswordPage } from '@web/features/auth'

export const Route = createFileRoute('/_auth/reset-password')({
  component: ResetPasswordPage,
})
