import type { QueryClient } from '@tanstack/react-query'

export type RouterContext = {
  queryClient: QueryClient
  waitForOpening: () => Promise<void>
}
