import { AppSplash } from '@web/components/brand/app-splash'
import { useEffect, useState } from 'react'

const SLOW_OPENING_MS = 1500

export function AppOpening() {
  const [isSlow, setIsSlow] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsSlow(true), SLOW_OPENING_MS)
    return () => clearTimeout(timer)
  }, [])

  return <AppSplash isSlow={isSlow} />
}
