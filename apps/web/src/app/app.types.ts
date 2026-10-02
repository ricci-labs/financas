import type { createApp } from '@web/app/router'

export type App = ReturnType<typeof createApp>

export type AppProvidersProps = {
  app?: App
}
