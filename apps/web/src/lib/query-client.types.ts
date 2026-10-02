export type QueryClientHandlers = {
  onSessionRequired: () => void
  onPermissionDenied: (error: unknown) => void
}
