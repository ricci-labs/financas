import { createFileRoute } from '@tanstack/react-router'
import { ForgotPasswordPage } from '@web/features/auth'

export const Route = createFileRoute('/_auth/forgot-password')({
  component: ForgotPasswordPage,
})
