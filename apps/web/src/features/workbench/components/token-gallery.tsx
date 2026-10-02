import { ThemePanels } from '@web/features/workbench/components/theme-panels'
import { tokenNames } from '@web/features/workbench/components/token-names'
import { workbenchMessages } from '@web/features/workbench/workbench.messages'

export function TokenGallery() {
  const { colors, typeStyles, radius, shadows } = tokenNames()
  return (
    <ThemePanels>
      <h3 className="mb-3 text-title-sm">{workbenchMessages.colors}</h3>
      <ul className="mb-6 grid grid-cols-2 gap-2 md:grid-cols-3">
        {colors.map((name) => (
          <li key={name} className="flex items-center gap-2 text-caption">
            <span
              className="size-8 shrink-0 rounded-sm border"
              style={{ background: `var(--${name})` }}
            />
            {name}
          </li>
        ))}
      </ul>
      <h3 className="mb-3 text-title-sm">{workbenchMessages.typeStyles}</h3>
      <ul className="mb-6 flex flex-col gap-3">
        {typeStyles.map((name) => (
          <li key={name}>
            <p className="text-caption text-ink-muted">{name}</p>
            <p
              style={{
                fontSize: `var(--text-${name})`,
                lineHeight: `var(--text-${name}--line-height)`,
                fontWeight: `var(--text-${name}--font-weight)`,
                letterSpacing: `var(--text-${name}--letter-spacing)`,
              }}
            >
              {workbenchMessages.sample}
            </p>
          </li>
        ))}
      </ul>
      <h3 className="mb-3 text-title-sm">{workbenchMessages.radius}</h3>
      <ul className="mb-6 flex flex-wrap gap-3">
        {radius.map((name) => (
          <li key={name} className="flex flex-col items-center gap-1 text-caption">
            <span
              className="size-12 border-2 bg-sunken"
              style={{ borderRadius: `var(--radius-${name})` }}
            />
            {name}
          </li>
        ))}
      </ul>
      <h3 className="mb-3 text-title-sm">{workbenchMessages.shadows}</h3>
      <ul className="flex flex-wrap gap-4">
        {shadows.map((name) => (
          <li
            key={name}
            className="flex size-24 items-center justify-center rounded-lg bg-surface text-caption"
            style={{ boxShadow: `var(--shadow-${name})` }}
          >
            {name}
          </li>
        ))}
      </ul>
    </ThemePanels>
  )
}
