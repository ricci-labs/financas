import { useMutation } from '@tanstack/react-query'
import { unwrap } from '@web/lib/api/unwrap'
import { apiClient } from '@web/lib/api-client'

export function useAcceptInvitation() {
  return useMutation({
    mutationFn: (token: string) =>
      unwrap(apiClient.api.invitations.accept.$post({ json: { token } })),
  })
}
