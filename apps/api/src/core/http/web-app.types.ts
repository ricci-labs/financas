import type { Http2Bindings, HttpBindings } from '@hono/node-server'

export type NodeFetch = (
  request: Request,
  env: HttpBindings | Http2Bindings,
) => Response | Promise<Response>
