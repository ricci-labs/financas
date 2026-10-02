import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import type { AppProvidersProps } from '@web/app/app.types'
import { app as defaultApp } from '@web/app/router'
import { Toaster } from '@web/components/feedback/toast'
import { AppUpdatePrompt } from '@web/features/app-update'

export function AppProviders({ app = defaultApp }: AppProvidersProps) {
  return (
    <QueryClientProvider client={app.queryClient}>
      <RouterProvider router={app.router} />
      <Toaster />
      <AppUpdatePrompt />
    </QueryClientProvider>
  )
}
