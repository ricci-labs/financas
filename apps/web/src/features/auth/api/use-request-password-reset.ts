import { useMutation } from '@tanstack/react-query'
import { unwrapEmpty } from '@web/lib/api/unwrap'
import { apiClient } from '@web/lib/api-client'

export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: (email: string) =>
      unwrapEmpty(apiClient.api.auth.password.forgot.$post({ json: { email } })),
  })
}
