import type { AppEnv } from '@api/core/http/http.types'
import { currentSession } from '@api/core/http/middleware/session'
import { jsonBody, pathParams, queryParams } from '@api/core/http/validation'
import { authorize, currentWorkspace } from '@api/modules/access'
import { addHoliday, deleteHoliday, listHolidays } from '@api/modules/planning/planning.service'
import type { PlanningRouteDeps } from '@api/modules/planning/planning.types'
import {
  deletionRequestSchema,
  holidayListQuerySchema,
  holidayParamsSchema,
  newHolidaySchema,
} from '@financas/shared'
import { Hono } from 'hono'

const CREATED = 201
const NO_CONTENT = 204

export function planningRoutes(deps: PlanningRouteDeps) {
  return new Hono<AppEnv>().route('/holidays', holidayRoutes(deps))
}

function holidayRoutes({ db }: PlanningRouteDeps) {
  return new Hono<AppEnv>()
    .get(
      '/',
      authorize('planning', 'view'),
      queryParams(holidayListQuerySchema, 'HOLIDAY_QUERY_INVALID'),
      async (c) => {
        const { workspaceId } = currentWorkspace(c)
        return c.json(await listHolidays(db, workspaceId, c.req.valid('query').year))
      },
    )
    .post(
      '/',
      authorize('planning', 'create'),
      jsonBody(newHolidaySchema, 'HOLIDAY_INVALID'),
      async (c) => {
        const { workspaceId } = currentWorkspace(c)
        const { userId } = currentSession(c)
        return c.json(await addHoliday(db, { workspaceId, userId }, c.req.valid('json')), CREATED)
      },
    )
    .delete(
      '/:holidayId',
      authorize('planning', 'delete'),
      pathParams(holidayParamsSchema, 'HOLIDAY_NOT_FOUND'),
      jsonBody(deletionRequestSchema, 'DELETION_INVALID'),
      async (c) => {
        const { workspaceId } = currentWorkspace(c)
        const { userId } = currentSession(c)
        const { holidayId } = c.req.valid('param')
        await deleteHoliday(db, {
          workspaceId,
          userId,
          holidayId,
          reason: c.req.valid('json').reason,
        })
        return c.body(null, NO_CONTENT)
      },
    )
}
