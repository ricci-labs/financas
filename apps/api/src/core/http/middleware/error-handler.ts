import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@api/core/http/errors'
import type { AppEnv } from '@api/core/http/http.types'
import { refOf } from '@api/core/http/middleware/request-context'
import type { Context, ErrorHandler, NotFoundHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

const INTERNAL_SERVER_ERROR = 500
const NOT_FOUND = 404

const STATUS_BY_ERROR_TYPE: ReadonlyArray<
  [new (...args: never[]) => AppError, ContentfulStatusCode]
> = [
  [ValidationError, 400],
  [UnauthorizedError, 401],
  [ForbiddenError, 403],
  [NotFoundError, 404],
  [ConflictError, 409],
]

const CODE_BY_HTTP_STATUS: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  413: 'PAYLOAD_TOO_LARGE',
  429: 'TOO_MANY_REQUESTS',
}

type ErrorBody = {
  error: { code: string; message: string; ref: string }
}

export const handleError: ErrorHandler<AppEnv> = (error, c) => {
  if (error instanceof AppError) {
    return respond(c, statusOf(error), error.code, error.message)
  }
  if (error instanceof HTTPException && error.status < INTERNAL_SERVER_ERROR) {
    const code = CODE_BY_HTTP_STATUS[error.status] ?? 'REQUEST_REJECTED'
    return respond(c, error.status, code, error.message)
  }

  c.get('logger').error(
    { event: 'http.request.failed', method: c.req.method, path: c.req.path, err: error },
    'Unexpected error while handling a request',
  )
  return respond(c, INTERNAL_SERVER_ERROR, 'INTERNAL_ERROR', 'Something went wrong')
}

export const handleNotFound: NotFoundHandler<AppEnv> = (c) =>
  respond(c, NOT_FOUND, 'ROUTE_NOT_FOUND', 'No route matches this request')

function statusOf(error: AppError): ContentfulStatusCode {
  const match = STATUS_BY_ERROR_TYPE.find(([errorType]) => error instanceof errorType)
  return match?.[1] ?? INTERNAL_SERVER_ERROR
}

function respond(c: Context<AppEnv>, status: ContentfulStatusCode, code: string, message: string) {
  c.set('errorCode', code)
  const body: ErrorBody = { error: { code, message, ref: refOf(c.get('requestId')) } }
  return c.json(body, status)
}
