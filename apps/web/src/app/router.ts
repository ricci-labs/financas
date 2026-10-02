import { createRouter, type RouterHistory } from '@tanstack/react-router'
import { hadSession } from '@web/features/auth'
import { createQueryClient } from '@web/lib/query-client'
import { routeTree } from '@web/routeTree.gen'

export function createApp(history?: RouterHistory) {
  const queryClient = createQueryClient({ onSessionRequired: () => endSession() })
  const router = createRouter({
    routeTree,
    history,
    context: { queryClient },
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
  })

  function endSession() {
    const wasLoggedIn = hadSession(queryClient)
    queryClient.clear()
    if (wasLoggedIn) {
      router.navigate({
        to: '/login',
        search: { next: router.state.location.href, notice: 'session-ended' },
      })
    }
  }

  return { queryClient, router }
}

export const app = createApp()
