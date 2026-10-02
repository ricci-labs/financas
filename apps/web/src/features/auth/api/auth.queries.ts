import { type QueryClient, queryOptions } from '@tanstack/react-query'
import { isSessionRequired } from '@web/lib/api/api-error'
import { unwrap } from '@web/lib/api/unwrap'
import { apiClient } from '@web/lib/api-client'
import { queryKeys } from '@web/lib/query-keys'

export function meQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.me,
    queryFn: () => unwrap(apiClient.api.auth.me.$get()),
  })
}

export function authConfigQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.authConfig,
    queryFn: () => unwrap(apiClient.api.auth.config.$get()),
  })
}

export async function loadSession(queryClient: QueryClient) {
  try {
    return await queryClient.ensureQueryData(meQueryOptions())
  } catch (error) {
    if (isSessionRequired(error)) {
      return null
    }
    throw error
  }
}

export function hadSession(queryClient: QueryClient): boolean {
  return queryClient.getQueryData(meQueryOptions().queryKey) !== undefined
}
