import type { AppEnv } from '@api/core/http/http.types'
import { currentSession } from '@api/core/http/middleware/session'
import { jsonBody, pathParams, queryParams } from '@api/core/http/validation'
import { authorize, currentWorkspace } from '@api/modules/access'
import {
  addHoliday,
  changeGoal,
  changeOccurrenceAmount,
  changeRecurrenceRule,
  createGoal,
  createRecurrenceRule,
  deleteGoal,
  deleteHoliday,
  deleteRecurrenceRule,
  listBudgets,
  listGoals,
  listHolidays,
  listOccurrences,
  listRecurrenceRules,
  matchOccurrence,
  setBudget,
  skipOccurrence,
  suggestOccurrencesForEntry,
  unmatchOccurrence,
  unskipOccurrence,
} from '@api/modules/planning/planning.service'
import type { PlanningRouteDeps } from '@api/modules/planning/planning.types'
import {
  budgetChangeSchema,
  budgetListQuerySchema,
  budgetParamsSchema,
  deletionRequestSchema,
  goalChangeSchema,
  goalParamsSchema,
  holidayListQuerySchema,
  holidayParamsSchema,
  newGoalSchema,
  newHolidaySchema,
  newRecurrenceRuleSchema,
  occurrenceChangeSchema,
  occurrenceListQuerySchema,
  occurrenceMatchSchema,
  occurrenceParamsSchema,
  occurrenceSuggestionQuerySchema,
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
    .route('/budgets', budgetRoutes(deps))
    .route('/goals', goalRoutes(deps))
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
  const occurrence = pathParams(occurrenceParamsSchema, 'OCCURRENCE_NOT_FOUND')

  return new Hono<AppEnv>()
    .get(
      '/',
      authorize('planning', 'view'),
      queryParams(occurrenceListQuerySchema, 'OCCURRENCE_QUERY_INVALID'),
      async (c) => {
        const { workspaceId } = currentWorkspace(c)
        return c.json(await listOccurrences(db, workspaceId, c.req.valid('query')))
      },
    )
    .get(
      '/suggestions',
      authorize('planning', 'view'),
      queryParams(occurrenceSuggestionQuerySchema, 'OCCURRENCE_QUERY_INVALID'),
      async (c) => {
        const { workspaceId } = currentWorkspace(c)
        const { entryId } = c.req.valid('query')
        return c.json(await suggestOccurrencesForEntry(db, workspaceId, entryId))
      },
    )
    .post(
      '/:occurrenceId/match',
      authorize('planning', 'update'),
      occurrence,
      jsonBody(occurrenceMatchSchema, 'OCCURRENCE_MATCH_INVALID'),
      async (c) => {
        const { workspaceId } = currentWorkspace(c)
        const { occurrenceId } = c.req.valid('param')
        await matchOccurrence(db, { workspaceId, occurrenceId }, c.req.valid('json').entryId)
        return c.body(null, NO_CONTENT)
      },
    )
    .post('/:occurrenceId/unmatch', authorize('planning', 'update'), occurrence, async (c) => {
      const { workspaceId } = currentWorkspace(c)
      await unmatchOccurrence(db, { workspaceId, occurrenceId: c.req.valid('param').occurrenceId })
      return c.body(null, NO_CONTENT)
    })
    .post('/:occurrenceId/skip', authorize('planning', 'update'), occurrence, async (c) => {
      const { workspaceId } = currentWorkspace(c)
      await skipOccurrence(db, { workspaceId, occurrenceId: c.req.valid('param').occurrenceId })
      return c.body(null, NO_CONTENT)
    })
    .post('/:occurrenceId/unskip', authorize('planning', 'update'), occurrence, async (c) => {
      const { workspaceId } = currentWorkspace(c)
      await unskipOccurrence(db, { workspaceId, occurrenceId: c.req.valid('param').occurrenceId })
      return c.body(null, NO_CONTENT)
    })
    .patch(
      '/:occurrenceId',
      authorize('planning', 'update'),
      occurrence,
      jsonBody(occurrenceChangeSchema, 'OCCURRENCE_INVALID'),
      async (c) => {
        const { workspaceId } = currentWorkspace(c)
        const { occurrenceId } = c.req.valid('param')
        await changeOccurrenceAmount(db, { workspaceId, occurrenceId }, c.req.valid('json'))
        return c.body(null, NO_CONTENT)
      },
    )
}

function budgetRoutes({ db }: PlanningRouteDeps) {
  return new Hono<AppEnv>()
    .get(
      '/',
      authorize('budgets', 'view'),
      queryParams(budgetListQuerySchema, 'BUDGET_QUERY_INVALID'),
      async (c) => {
        const { workspaceId } = currentWorkspace(c)
        return c.json(await listBudgets(db, workspaceId, c.req.valid('query').period))
      },
    )
    .put(
      '/:categoryId',
      authorize('budgets', 'update'),
      pathParams(budgetParamsSchema, 'BUDGET_CATEGORY_NOT_FOUND'),
      jsonBody(budgetChangeSchema, 'BUDGET_INVALID'),
      async (c) => {
        const { workspaceId } = currentWorkspace(c)
        const categoryAccountId = c.req.valid('param').categoryId
        await setBudget(db, { workspaceId, categoryAccountId }, c.req.valid('json'))
        return c.body(null, NO_CONTENT)
      },
    )
}

function goalRoutes({ db }: PlanningRouteDeps) {
  const goal = pathParams(goalParamsSchema, 'GOAL_NOT_FOUND')

  return new Hono<AppEnv>()
    .get('/', authorize('planning', 'view'), async (c) => {
      return c.json(await listGoals(db, currentWorkspace(c).workspaceId))
    })
    .post(
      '/',
      authorize('planning', 'create'),
      jsonBody(newGoalSchema, 'GOAL_INVALID'),
      async (c) => {
        const { workspaceId } = currentWorkspace(c)
        const { userId } = currentSession(c)
        return c.json(await createGoal(db, { workspaceId, userId }, c.req.valid('json')), CREATED)
      },
    )
    .patch(
      '/:goalId',
      authorize('planning', 'update'),
      goal,
      jsonBody(goalChangeSchema, 'GOAL_INVALID'),
      async (c) => {
        const { workspaceId } = currentWorkspace(c)
        await changeGoal(
          db,
          { workspaceId, goalId: c.req.valid('param').goalId },
          c.req.valid('json'),
        )
        return c.body(null, NO_CONTENT)
      },
    )
    .delete(
      '/:goalId',
      authorize('planning', 'delete'),
      goal,
      jsonBody(deletionRequestSchema, 'DELETION_INVALID'),
      async (c) => {
        const { workspaceId } = currentWorkspace(c)
        const { userId } = currentSession(c)
        const { goalId } = c.req.valid('param')
        await deleteGoal(db, { workspaceId, goalId, userId, reason: c.req.valid('json').reason })
        return c.body(null, NO_CONTENT)
      },
    )
}
