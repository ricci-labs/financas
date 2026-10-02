import type { app } from '@web/app/router'

declare module '@tanstack/react-router' {
  interface Register {
    router: (typeof app)['router']
  }
}
