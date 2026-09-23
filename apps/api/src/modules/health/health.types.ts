export type HealthDeps = {
  version: string
  startedAt: number
  isDatabaseReachable: () => Promise<boolean>
  now?: () => number
}
