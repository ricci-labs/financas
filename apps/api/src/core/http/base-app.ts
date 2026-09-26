import type { AppEnv } from '@api/core/http/http.types'
import { handleError, handleNotFound } from '@api/core/http/middleware/error-handler'
import { requestContext } from '@api/core/http/middleware/request-context'
import type { Logger } from '@api/core/observability/logger'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { HTTPException } from 'hono/http-exception'
import { secureHeaders } from 'hono/secure-headers'

export const MAX_REQUEST_BODY_BYTES = 100 * 1024
const PAYLOAD_TOO_LARGE = 413

export function createBaseApp(logger: Logger) {
  return new Hono<AppEnv>()
    .use(requestContext(logger))
    .use(secureHeaders())
    .use('/api/*', bodyLimit({ maxSize: MAX_REQUEST_BODY_BYTES, onError: rejectLargeBody }))
    .onError(handleError)
    .notFound(handleNotFound)
}

function rejectLargeBody(): never {
  throw new HTTPException(PAYLOAD_TOO_LARGE, { message: 'The request body is too large' })
}
