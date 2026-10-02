import { useMutation } from '@tanstack/react-query'
import { unwrap } from '@web/lib/api/unwrap'
import { apiClient } from '@web/lib/api-client'

export function previewInvitation(token: string) {
  return unwrap(apiClient.api.invitations.preview.$post({ json: { token } }))
}

export function usePreviewInvitation() {
  return useMutation({ mutationFn: previewInvitation })
}
