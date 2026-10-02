import { page } from 'vitest/browser'

export function fieldLabelled(labelText: string) {
  const label = [...document.querySelectorAll('label')].find(
    (element) => element.firstChild?.textContent?.trim() === labelText,
  )
  const control = label?.control
  if (!control) {
    throw new Error(`No field labelled "${labelText}"`)
  }
  return page.elementLocator(control)
}
