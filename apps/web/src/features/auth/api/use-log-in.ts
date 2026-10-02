import type { Credentials } from '@financas/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { unwrap } from '@web/lib/api/unwrap'
import { apiClient } from '@web/lib/api-client'

export function useLogIn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (credentials: Credentials) =>
      unwrap(apiClient.api.auth.login.$post({ json: credentials })),
    onSuccess: () => {
      queryClient.clear()
    },
  })
}
