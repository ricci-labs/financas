import type { TemplateValues } from '@web/lib/format/format.types'

const PLACEHOLDER = /\{([^}]+)\}/g

export function fill(template: string, values: TemplateValues): string {
  return template.replace(PLACEHOLDER, (placeholder, name: string) =>
    name in values ? String(values[name]) : placeholder,
  )
}
