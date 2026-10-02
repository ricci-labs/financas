import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { unwrapEmpty } from '@web/lib/api/unwrap'
import { apiClient } from '@web/lib/api-client'

export function useLogOut() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: () => unwrapEmpty(apiClient.api.auth.logout.$post()),
    onSettled: () => {
      queryClient.clear()
      void navigate({ to: '/login', search: { notice: 'logged-out' } })
    },
  })
}
