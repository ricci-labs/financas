import { apiErrorBodySchema } from '@web/lib/api/api.schemas'
import type { ApiResponse } from '@web/lib/api/api.types'
import { ApiError, NetworkError, UNKNOWN_ERROR_CODE } from '@web/lib/api/api-error'

const RETRY_AFTER_HEADER = 'Retry-After'

export async function unwrap<Body>(request: Promise<ApiResponse<Body>>): Promise<Body> {
  const response = await send(request)
  if (response.ok) {
    return response.json()
  }
  throw await errorFrom(response)
}

export async function unwrapEmpty(request: Promise<ApiResponse<unknown>>): Promise<void> {
  const response = await send(request)
  if (!response.ok) {
    throw await errorFrom(response)
  }
}

async function send<Body>(request: Promise<ApiResponse<Body>>): Promise<ApiResponse<Body>> {
  try {
    return await request
  } catch (cause) {
    throw new NetworkError(cause)
  }
}

async function errorFrom(response: ApiResponse<unknown>): Promise<ApiError> {
  const body = apiErrorBodySchema.safeParse(await response.json().catch(() => null))
  return new ApiError({
    status: response.status,
    code: body.success ? body.data.error.code : UNKNOWN_ERROR_CODE,
    ref: body.success ? (body.data.error.ref ?? null) : null,
    retryAfterSeconds: retryAfterSecondsOf(response.headers),
  })
}

function retryAfterSecondsOf(headers: Headers): number | null {
  const seconds = Number.parseInt(headers.get(RETRY_AFTER_HEADER) ?? '', 10)
  return Number.isNaN(seconds) ? null : seconds
}
