import type { AppEnv } from '@api/core/http/http.types'
import { handleError, handleNotFound } from '@api/core/http/middleware/error-handler'
import { requestContext } from '@api/core/http/middleware/request-context'
import type { NodeFetch } from '@api/core/http/web-app.types'
import type { Logger } from '@api/core/observability/logger'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono, type MiddlewareHandler } from 'hono'
import { secureHeaders } from 'hono/secure-headers'

const API_PREFIX = '/api/'
const ASSETS_PREFIX = '/assets/'
const INDEX_FILE = 'index.html'
const HAS_FILE_EXTENSION = /\.[a-z0-9]+$/i
const CACHE_CONTROL = 'Cache-Control'
const IMMUTABLE = 'public, max-age=31536000, immutable'
const REVALIDATE = 'no-cache'
const SELF = "'self'"
const NONE = "'none'"

export const CONTENT_SECURITY_POLICY = {
  defaultSrc: [SELF],
  scriptSrc: [SELF],
  styleSrc: [SELF],
  fontSrc: [SELF],
  imgSrc: [SELF, 'data:', 'blob:'],
  connectSrc: [SELF],
  workerSrc: [SELF],
  manifestSrc: [SELF],
  objectSrc: [NONE],
  baseUri: [SELF],
  formAction: [SELF],
  frameAncestors: [NONE],
}

export function createWebApp(logger: Logger, webDistDir: string) {
  const assets = cached(IMMUTABLE, serveStatic({ root: webDistDir }))
  const files = cached(REVALIDATE, serveStatic({ root: webDistDir }))
  const index = cached(REVALIDATE, serveStatic({ root: webDistDir, path: INDEX_FILE }))
  return new Hono<AppEnv>()
    .use(requestContext(logger))
    .use(secureHeaders({ contentSecurityPolicy: CONTENT_SECURITY_POLICY }))
    .use(`${ASSETS_PREFIX}*`, assets)
    .use('*', files)
    .get('*', onlyForPages(index))
    .onError(handleError)
    .notFound(handleNotFound)
}

export function routeByPath(api: NodeFetch, web: NodeFetch): NodeFetch {
  return (request, env) => {
    const isApiRequest = new URL(request.url).pathname.startsWith(API_PREFIX)
    return isApiRequest ? api(request, env) : web(request, env)
  }
}

function cached(value: string, handler: MiddlewareHandler<AppEnv>): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    let wasNotFound = false
    const response = await handler(c, async () => {
      wasNotFound = true
      await next()
    })
    if (!wasNotFound) {
      c.res.headers.set(CACHE_CONTROL, value)
    }
    return response
  }
}

function onlyForPages(handler: MiddlewareHandler<AppEnv>): MiddlewareHandler<AppEnv> {
  return (c, next) => {
    const isFileRequest =
      c.req.path.startsWith(ASSETS_PREFIX) || HAS_FILE_EXTENSION.test(c.req.path)
    return isFileRequest ? next() : handler(c, next)
  }
}
