import { useRouter } from '@tanstack/react-router'
import { tokenFromFragment } from '@web/lib/link-token'
import { useLayoutEffect, useState } from 'react'

export function useLinkToken(): string | null {
  const { history } = useRouter()
  const [token] = useState(() => tokenFromFragment(history.location.hash))

  useLayoutEffect(() => {
    const { pathname, search, hash } = history.location
    if (hash) {
      history.replace(`${pathname}${search}`)
    }
  }, [history])

  return token
}
