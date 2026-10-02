import { createFileRoute } from '@tanstack/react-router'
import { StatusPage } from '@web/features/system-status'

export const Route = createFileRoute('/_app/')({
  component: StatusPage,
})
