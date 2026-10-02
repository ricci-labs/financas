import type { NewUserFields } from '@financas/shared'
import { useMutation } from '@tanstack/react-query'
import { unwrapEmpty } from '@web/lib/api/unwrap'
import { apiClient } from '@web/lib/api-client'

export function useSignUp() {
  return useMutation({
    mutationFn: (newUser: NewUserFields) =>
      unwrapEmpty(apiClient.api.auth.signup.$post({ json: newUser })),
  })
}
