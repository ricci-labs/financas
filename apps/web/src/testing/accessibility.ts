import axe from 'axe-core'
import { expect } from 'vitest'

export async function expectNoAccessibilityViolations(container: Element) {
  await settleTransitions()
  const { violations } = await axe.run(container)
  const summary = violations.map(
    (violation) =>
      `${violation.id}: ${violation.help} → ${violation.nodes.map((node) => `${node.target.join(' ')} "${node.html}" (${node.failureSummary ?? ''})`).join('; ')}`,
  )
  expect(summary).toEqual([])
}

async function settleTransitions() {
  const finite = document
    .getAnimations()
    .filter((animation) => animation.effect?.getTiming().iterations !== Number.POSITIVE_INFINITY)
  await Promise.allSettled(finite.map((animation) => animation.finished))
}
