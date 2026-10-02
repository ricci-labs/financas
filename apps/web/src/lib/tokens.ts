import type { ThemeUtilityNames } from '@web/lib/tokens.types'
import semanticCss from '@web/styles/tokens/semantic.css?raw'
import themeCss from '@web/styles/tokens/theme.css?raw'

const NAMESPACE_DECLARATION = /--(color|text|spacing|shadow|radius|font)-([a-z0-9-]+)\s*:/g
const SUB_PROPERTY = '--'
const RESET_VALUE = '*'
const NON_COLOR_PREFIXES = ['elevation-', 'duration-', 'z-', 'stroke-']
const SEMANTIC_DECLARATION = /--([a-z0-9-]+)\s*:/g

export function themeUtilityNames(): ThemeUtilityNames {
  const names: ThemeUtilityNames = {
    color: [],
    text: [],
    spacing: [],
    shadow: [],
    radius: [],
    font: [],
  }
  for (const [, namespace, name] of themeCss.matchAll(NAMESPACE_DECLARATION)) {
    const isUtilityName = name && !name.includes(SUB_PROPERTY) && name !== RESET_VALUE
    const list = names[namespace as keyof ThemeUtilityNames]
    if (isUtilityName && !list.includes(name)) {
      list.push(name)
    }
  }
  return names
}

export function semanticRoleNames(): string[] {
  const names = [...semanticCss.matchAll(SEMANTIC_DECLARATION)].flatMap(([, name]) =>
    name && !NON_COLOR_PREFIXES.some((prefix) => name.startsWith(prefix)) ? [name] : [],
  )
  return [...new Set(names)]
}
