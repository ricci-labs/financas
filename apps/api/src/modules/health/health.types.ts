export type HealthDeps = {
  version: string
  startedAt: number
  now?: () => number
}
