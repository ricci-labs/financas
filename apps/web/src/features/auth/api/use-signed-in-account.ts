import { useQuery } from '@tanstack/react-query'
import { meQueryOptions } from '@web/features/auth/api/auth.queries'

export function useSignedInAccount() {
  return useQuery({ ...meQueryOptions(), enabled: false }).data ?? null
}
