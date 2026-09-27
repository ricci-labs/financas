import type { AppEnv, Completion } from '@api/core/http/http.types'
import type { Logger } from '@api/core/observability/logger'
import { appMetrics } from '@api/core/observability/metrics'
import { newTraceId, runInOperation } from '@api/core/observability/operation-context'
import { createMiddleware } from 'hono/factory'
import { routePath } from 'hono/route'

const REQUEST_ID_HEADER = 'X-Request-Id'
const REF_LENGTH = 8
const CLIENT_ERROR_STATUS = 400
const SERVER_ERROR_STATUS = 500
const LAST_MATCHED_ROUTE = -1
const MS_PER_SECOND = 1000

export function requestContext(rootLogger: Logger) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const requestId = newTraceId()
    const logger = rootLogger.child({ trace_id: requestId, channel: 'web' })
    c.set('requestId', requestId)
    c.set('logger', logger)
    c.header(REQUEST_ID_HEADER, requestId)

    const startedAt = performance.now()
    await runInOperation({ traceId: requestId, source: 'web', actorUserId: null }, next)
    logCompletion(logger, {
      method: c.req.method,
      route: routePath(c, LAST_MATCHED_ROUTE),
      status: c.res.status,
      code: c.get('errorCode'),
      durationMs: Math.round(performance.now() - startedAt),
    })
  })
}

export function refOf(requestId: string): string {
  return requestId.slice(0, REF_LENGTH)
}

function logCompletion(logger: Logger, completion: Completion): void {
  appMetrics().httpRequestDuration.record(completion.durationMs / MS_PER_SECOND, {
    'http.route': completion.route,
    'http.request.method': completion.method,
    'http.response.status_code': completion.status,
  })
  if (completion.status >= SERVER_ERROR_STATUS) {
    return
  }
  if (completion.status >= CLIENT_ERROR_STATUS) {
    logger.info({ event: 'http.request.rejected', ...completion }, 'Request rejected')
    return
  }
  logger.debug({ event: 'http.request.completed', ...completion }, 'Request completed')
}
