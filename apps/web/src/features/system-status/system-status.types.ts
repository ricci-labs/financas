export type ApiStatus =
  | { state: 'checking' }
  | { state: 'online'; version: string }
  | { state: 'offline' }
