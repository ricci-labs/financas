import type { ReactNode } from 'react'

export type ApiStatus =
  | { state: 'checking' }
  | { state: 'online'; version: string }
  | { state: 'offline' }

export type StatusPageProps = {
  action?: ReactNode
}
