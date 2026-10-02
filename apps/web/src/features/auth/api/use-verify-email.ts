import { useMutation } from '@tanstack/react-query'
import { unwrapEmpty } from '@web/lib/api/unwrap'
import { apiClient } from '@web/lib/api-client'

export function useVerifyEmail() {
  return useMutation({
    mutationFn: (token: string) =>
      unwrapEmpty(apiClient.api.auth['verify-email'].$post({ json: { token } })),
  })
}
