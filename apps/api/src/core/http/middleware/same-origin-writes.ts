import { ForbiddenError } from '@api/core/http/errors'
import { createMiddleware } from 'hono/factory'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const SAME_ORIGIN_FETCH = 'same-origin'

export function sameOriginWrites(allowedOrigin: string) {
  return createMiddleware(async (c, next) => {
    const isWrite = !SAFE_METHODS.has(c.req.method)
    const isFromOurPages =
      c.req.header('Sec-Fetch-Site') === SAME_ORIGIN_FETCH ||
      c.req.header('Origin') === allowedOrigin
    if (isWrite && !isFromOurPages) {
      throw new ForbiddenError('CROSS_SITE_REQUEST', 'Writes must come from the app itself')
    }
    await next()
  })
}
