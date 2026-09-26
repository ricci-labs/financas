import type { AppEnv } from '@api/core/http/http.types'
import { queryParams } from '@api/core/http/validation'
import { authorize, currentWorkspace } from '@api/modules/access'
import {
  getPeriodOverview,
  simulatePurchaseImpact,
  suggestAllocation,
} from '@api/modules/reports/reports.service'
import type { ReportRouteDeps } from '@api/modules/reports/reports.types'
import {
  allocationSuggestionQuerySchema,
  overviewQuerySchema,
  purchaseSimulationQuerySchema,
} from '@financas/shared'
import { Hono } from 'hono'

export function reportRoutes({ db }: ReportRouteDeps) {
  return new Hono<AppEnv>()
    .get(
      '/overview',
      authorize('reports', 'view'),
      queryParams(overviewQuerySchema, 'OVERVIEW_QUERY_INVALID'),
      async (c) => {
        const { workspaceId } = currentWorkspace(c)
        return c.json(await getPeriodOverview(db, workspaceId, c.req.valid('query')))
      },
    )
    .get(
      '/allocation/suggestion',
      authorize('reports', 'view'),
      queryParams(allocationSuggestionQuerySchema, 'ALLOCATION_QUERY_INVALID'),
      async (c) => {
        const { workspaceId } = currentWorkspace(c)
        const { amountCents } = c.req.valid('query')
        return c.json(await suggestAllocation(db, workspaceId, amountCents))
      },
    )
    .get(
      '/simulations/purchase',
      authorize('reports', 'view'),
      queryParams(purchaseSimulationQuerySchema, 'SIMULATION_QUERY_INVALID'),
      async (c) => {
        const { workspaceId } = currentWorkspace(c)
        return c.json(await simulatePurchaseImpact(db, workspaceId, c.req.valid('query')))
      },
    )
}
