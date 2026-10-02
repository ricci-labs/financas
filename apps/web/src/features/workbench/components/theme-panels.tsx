import { workbenchMessages } from '@web/features/workbench/workbench.messages'
import type { ThemePanelsProps } from '@web/features/workbench/workbench.types'

export function ThemePanels({ children }: ThemePanelsProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-lg border bg-page p-5 text-ink">
        <p className="mb-4 text-caption text-ink-muted">{workbenchMessages.light}</p>
        {children}
      </section>
      <section className="dark rounded-lg border bg-page p-5 text-ink">
        <p className="mb-4 text-caption text-ink-muted">{workbenchMessages.dark}</p>
        {children}
      </section>
    </div>
  )
}
