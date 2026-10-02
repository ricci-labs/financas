import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import type { LogOutReturn } from '@web/features/auth/auth.types'
import { unwrapEmpty } from '@web/lib/api/unwrap'
import { apiClient } from '@web/lib/api-client'

export function useLogOut() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: (_returnTo?: LogOutReturn) => unwrapEmpty(apiClient.api.auth.logout.$post()),
    onSettled: (_answer, _error, returnTo) => {
      queryClient.clear()
      void navigate({
        to: '/login',
        search: { notice: 'logged-out', next: returnTo?.next },
        state: { inviteToken: returnTo?.inviteToken },
      })
    },
  })
}
