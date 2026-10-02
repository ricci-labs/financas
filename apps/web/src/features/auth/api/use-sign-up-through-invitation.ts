import type { InvitationSignUpRequest } from '@financas/shared'
import { useMutation } from '@tanstack/react-query'
import { unwrap } from '@web/lib/api/unwrap'
import { apiClient } from '@web/lib/api-client'

export function useSignUpThroughInvitation() {
  return useMutation({
    mutationFn: (request: InvitationSignUpRequest) =>
      unwrap(apiClient.api.invitations['sign-up'].$post({ json: request })),
  })
}
