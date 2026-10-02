import { ThemePanels } from '@web/features/workbench/components/theme-panels'
import { TokenGallery } from '@web/features/workbench/components/token-gallery'
import { workbenchSections } from '@web/features/workbench/components/workbench-sections'
import { workbenchMessages } from '@web/features/workbench/workbench.messages'

export function WorkbenchPage() {
  return (
    <main className="flex flex-col gap-10 bg-page px-4 py-8 text-ink lg:px-12">
      <header>
        <h1 className="font-display text-display">{workbenchMessages.title}</h1>
        <p className="text-body-sm text-ink-muted">{workbenchMessages.subtitle}</p>
      </header>
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-title-lg">{workbenchMessages.tokens}</h2>
        <TokenGallery />
      </section>
      {workbenchSections.map(({ component, examples }) => (
        <section key={component} className="flex flex-col gap-4">
          <h2 className="font-display text-title-lg">{component}</h2>
          <ThemePanels>
            <ul className="flex flex-col gap-5">
              {examples.map(({ name, render }) => (
                <li key={name} className="flex flex-col gap-2">
                  <p className="text-caption text-ink-muted">{name}</p>
                  <div className="flex flex-wrap items-center gap-3">{render()}</div>
                </li>
              ))}
            </ul>
          </ThemePanels>
        </section>
      ))}
    </main>
  )
}
