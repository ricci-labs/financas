export type Terminal = {
  ask: (question: string) => Promise<string>
  askSecret: (question: string) => Promise<string>
  say: (message: string) => void
  close: () => void
}
