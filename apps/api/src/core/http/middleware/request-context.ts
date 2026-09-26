import { randomBytes } from 'node:crypto'
import type { AppEnv } from '@api/core/http/http.types'
import type { Logger } from '@api/core/observability/logger'
import { createMiddleware } from 'hono/factory'
import { routePath } from 'hono/route'

const REQUEST_ID_BYTES = 16
const REQUEST_ID_HEADER = 'X-Request-Id'
const REF_LENGTH = 8
const CLIENT_ERROR_STATUS = 400
const SERVER_ERROR_STATUS = 500
const LAST_MATCHED_ROUTE = -1

export function requestContext(rootLogger: Logger) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const requestId = randomBytes(REQUEST_ID_BYTES).toString('hex')
    const logger = rootLogger.child({ trace_id: requestId, channel: 'web' })
    c.set('requestId', requestId)
    c.set('logger', logger)
    c.header(REQUEST_ID_HEADER, requestId)

    const startedAt = performance.now()
    await next()
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

type Completion = {
  method: string
  route: string
  status: number
  code: string | undefined
  durationMs: number
}

function logCompletion(logger: Logger, completion: Completion): void {
  if (completion.status >= SERVER_ERROR_STATUS) {
    return
  }
  if (completion.status >= CLIENT_ERROR_STATUS) {
    logger.info({ event: 'http.request.rejected', ...completion }, 'Request rejected')
    return
  }
  logger.debug({ event: 'http.request.completed', ...completion }, 'Request completed')
}
