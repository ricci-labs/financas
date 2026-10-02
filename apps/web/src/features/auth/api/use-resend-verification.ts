import { useMutation } from '@tanstack/react-query'
import { unwrapEmpty } from '@web/lib/api/unwrap'
import { apiClient } from '@web/lib/api-client'

export function useResendVerification() {
  return useMutation({
    mutationFn: (email: string) =>
      unwrapEmpty(apiClient.api.auth['verify-email'].resend.$post({ json: { email } })),
  })
}
