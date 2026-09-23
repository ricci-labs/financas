import { apiClient } from '@web/lib/api-client'
import { useEffect, useState } from 'react'

export type ApiStatus =
  | { state: 'checking' }
  | { state: 'online'; version: string }
  | { state: 'offline' }

export function useApiStatus(): ApiStatus {
  const [status, setStatus] = useState<ApiStatus>({ state: 'checking' })

  useEffect(() => {
    let isMounted = true

    async function checkApi() {
      try {
        const response = await apiClient.api.health.ready.$get()
        const body = await response.json()
        if (isMounted) {
          setStatus({ state: 'online', version: body.version })
        }
      } catch {
        if (isMounted) {
          setStatus({ state: 'offline' })
        }
      }
    }

    checkApi()
    return () => {
      isMounted = false
    }
  }, [])

  return status
}
