import { createFileRoute, notFound } from '@tanstack/react-router'
import { WorkbenchPage } from '@web/features/workbench'

export const Route = createFileRoute('/dev/components')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) {
      throw notFound()
    }
  },
  component: import.meta.env.DEV ? WorkbenchPage : () => null,
})
