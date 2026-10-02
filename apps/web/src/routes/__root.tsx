import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import type { RouterContext } from '@web/lib/router-context.types'

export const Route = createRootRouteWithContext<RouterContext>()({
  component: Outlet,
})
