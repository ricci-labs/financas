import { useRouterState } from '@tanstack/react-router'

export function useArrivalEmail(): string | undefined {
  return useRouterState({ select: (state) => state.location.state.email })
}
