import { type HistoryState, useRouterState } from '@tanstack/react-router'

export function useArrivalState(): HistoryState {
  return useRouterState({ select: (state) => state.location.state })
}
