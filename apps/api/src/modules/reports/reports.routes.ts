import type { AppEnv } from '@api/core/http/http.types'
import { queryParams } from '@api/core/http/validation'
import { authorize, currentWorkspace } from '@api/modules/access'
import { getPeriodOverview } from '@api/modules/reports/reports.service'
import type { ReportRouteDeps } from '@api/modules/reports/reports.types'
import { overviewQuerySchema } from '@financas/shared'
import { Hono } from 'hono'

export function reportRoutes({ db }: ReportRouteDeps) {
  return new Hono<AppEnv>().get(
    '/overview',
    authorize('reports', 'view'),
    queryParams(overviewQuerySchema, 'OVERVIEW_QUERY_INVALID'),
    async (c) => {
      const { workspaceId } = currentWorkspace(c)
      return c.json(await getPeriodOverview(db, workspaceId, c.req.valid('query')))
    },
  )
}
