import { createRouter, type RouterHistory } from '@tanstack/react-router'
import { showToast } from '@web/components/feedback/toast'
import { hadSession } from '@web/features/auth'
import { errorMessageFor } from '@web/lib/errors/error-message'
import { createQueryClient } from '@web/lib/query-client'
import { queryKeys, WORKSPACE_KEY_PREFIX } from '@web/lib/query-keys'
import { routeTree } from '@web/routeTree.gen'

export function createApp(history?: RouterHistory) {
  const queryClient = createQueryClient({
    onSessionRequired: () => endSession(),
    onPermissionDenied: (error) => refreshPermissions(error),
  })
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

  function refreshPermissions(error: unknown) {
    showToast(errorMessageFor(error))
    void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces })
    void queryClient.invalidateQueries({ queryKey: [WORKSPACE_KEY_PREFIX] })
  }

  return { queryClient, router }
}

export const app = createApp()
