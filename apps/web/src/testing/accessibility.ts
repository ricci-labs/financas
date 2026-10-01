import axe from 'axe-core'
import { expect } from 'vitest'

export async function expectNoAccessibilityViolations(container: Element) {
  const { violations } = await axe.run(container)
  const summary = violations.map((violation) => `${violation.id}: ${violation.help}`)
  expect(summary).toEqual([])
}
