import { useSyncExternalStore } from 'react'

const CONNECTION_EVENTS = ['online', 'offline'] as const

function subscribeToConnection(onChange: () => void): () => void {
  for (const event of CONNECTION_EVENTS) {
    window.addEventListener(event, onChange)
  }
  return () => {
    for (const event of CONNECTION_EVENTS) {
      window.removeEventListener(event, onChange)
    }
  }
}

function isOnline(): boolean {
  return navigator.onLine
}

export function useIsOnline(): boolean {
  return useSyncExternalStore(subscribeToConnection, isOnline)
}
