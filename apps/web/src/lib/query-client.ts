import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { isRetryable, isSessionRequired } from '@web/lib/api/api-error'
import type { QueryClientHandlers } from '@web/lib/query-client.types'

const STALE_TIME_MS = 30_000
const MAX_QUERY_RETRIES = 2

export function createQueryClient({ onSessionRequired }: QueryClientHandlers): QueryClient {
  const handleError = (error: unknown) => {
    if (isSessionRequired(error)) {
      onSessionRequired()
    }
  }
  return new QueryClient({
    queryCache: new QueryCache({ onError: handleError }),
    mutationCache: new MutationCache({ onError: handleError }),
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME_MS,
        retry: (failureCount, error) => isRetryable(error) && failureCount < MAX_QUERY_RETRIES,
      },
      mutations: { retry: false },
    },
  })
}
