import { pageTitleMessages } from '@web/lib/page-title/page-title.messages'
import { useEffect } from 'react'

export function usePageTitle(screen: string): void {
  useEffect(() => {
    document.title = pageTitleMessages.of(screen)
  }, [screen])
}
