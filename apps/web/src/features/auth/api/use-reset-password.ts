import type { ResetPasswordRequest } from '@financas/shared'
import { useMutation } from '@tanstack/react-query'
import { unwrapEmpty } from '@web/lib/api/unwrap'
import { apiClient } from '@web/lib/api-client'

export function useResetPassword() {
  return useMutation({
    mutationFn: (request: ResetPasswordRequest) =>
      unwrapEmpty(apiClient.api.auth.password.reset.$post({ json: request })),
  })
}
