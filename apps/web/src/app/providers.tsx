import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import type { AppProvidersProps } from '@web/app/app.types'
import { app as defaultApp } from '@web/app/router'

export function AppProviders({ app = defaultApp }: AppProvidersProps) {
  return (
    <QueryClientProvider client={app.queryClient}>
      <RouterProvider router={app.router} />
    </QueryClientProvider>
  )
}
