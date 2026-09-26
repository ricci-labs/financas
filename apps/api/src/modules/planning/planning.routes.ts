import type { AppEnv } from '@api/core/http/http.types'
import { currentSession } from '@api/core/http/middleware/session'
import { jsonBody, pathParams, queryParams } from '@api/core/http/validation'
import { authorize, currentWorkspace } from '@api/modules/access'
import {
  addHoliday,
  changeRecurrenceRule,
  createRecurrenceRule,
  deleteHoliday,
  deleteRecurrenceRule,
  listHolidays,
  listOccurrences,
  listRecurrenceRules,
} from '@api/modules/planning/planning.service'
import type { PlanningRouteDeps } from '@api/modules/planning/planning.types'
import {
  deletionRequestSchema,
  holidayListQuerySchema,
  holidayParamsSchema,
  newHolidaySchema,
  newRecurrenceRuleSchema,
  occurrenceListQuerySchema,
  recurrenceRuleChangeSchema,
  recurrenceRuleParamsSchema,
} from '@financas/shared'
import { Hono } from 'hono'

const CREATED = 201
const NO_CONTENT = 204

export function planningRoutes(deps: PlanningRouteDeps) {
  return new Hono<AppEnv>()
    .route('/holidays', holidayRoutes(deps))
    .route('/recurrences', recurrenceRoutes(deps))
    .route('/occurrences', occurrenceRoutes(deps))
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

function recurrenceRoutes({ db }: PlanningRouteDeps) {
  const rule = pathParams(recurrenceRuleParamsSchema, 'RECURRENCE_NOT_FOUND')

  return new Hono<AppEnv>()
    .get('/', authorize('planning', 'view'), async (c) => {
      return c.json(await listRecurrenceRules(db, currentWorkspace(c).workspaceId))
    })
    .post(
      '/',
      authorize('planning', 'create'),
      jsonBody(newRecurrenceRuleSchema, 'RECURRENCE_INVALID'),
      async (c) => {
        const { workspaceId } = currentWorkspace(c)
        const { userId } = currentSession(c)
        const created = await createRecurrenceRule(db, { workspaceId, userId }, c.req.valid('json'))
        return c.json(created, CREATED)
      },
    )
    .patch(
      '/:ruleId',
      authorize('planning', 'update'),
      rule,
      jsonBody(recurrenceRuleChangeSchema, 'RECURRENCE_INVALID'),
      async (c) => {
        const { workspaceId } = currentWorkspace(c)
        const { ruleId } = c.req.valid('param')
        await changeRecurrenceRule(db, { workspaceId, ruleId }, c.req.valid('json'))
        return c.body(null, NO_CONTENT)
      },
    )
    .delete(
      '/:ruleId',
      authorize('planning', 'delete'),
      rule,
      jsonBody(deletionRequestSchema, 'DELETION_INVALID'),
      async (c) => {
        const { workspaceId } = currentWorkspace(c)
        const { userId } = currentSession(c)
        const { ruleId } = c.req.valid('param')
        await deleteRecurrenceRule(db, {
          workspaceId,
          ruleId,
          userId,
          reason: c.req.valid('json').reason,
        })
        return c.body(null, NO_CONTENT)
      },
    )
}

function occurrenceRoutes({ db }: PlanningRouteDeps) {
  return new Hono<AppEnv>().get(
    '/',
    authorize('planning', 'view'),
    queryParams(occurrenceListQuerySchema, 'OCCURRENCE_QUERY_INVALID'),
    async (c) => {
      const { workspaceId } = currentWorkspace(c)
      return c.json(await listOccurrences(db, workspaceId, c.req.valid('query')))
    },
  )
}
