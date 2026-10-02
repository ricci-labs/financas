import type { ReactNode } from 'react'

export type ComponentExample = {
  name: string
  render: () => ReactNode
}

export type ComponentExamples = {
  component: string
  examples: readonly ComponentExample[]
}
