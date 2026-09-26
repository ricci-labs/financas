import { isIP } from 'node:net'
import type { NodeBindings } from '@api/core/http/http.types'
import type { Context } from 'hono'

const UNKNOWN_CLIENT = 'unknown'
const FORWARDED_FOR_HEADER = 'X-Forwarded-For'

export function clientIpOf(c: Context, trustedProxyHops: number): string {
  const address = trustedProxyHops > 0 ? forwardedAddress(c, trustedProxyHops) : socketAddressOf(c)
  return address && isIP(address) ? address : UNKNOWN_CLIENT
}

function forwardedAddress(c: Context, trustedProxyHops: number): string | undefined {
  const hops = (c.req.header(FORWARDED_FOR_HEADER) ?? '')
    .split(',')
    .map((hop) => hop.trim())
    .filter((hop) => hop.length > 0)
  const addressSeenByOutermostProxy = hops.at(-trustedProxyHops)
  return addressSeenByOutermostProxy ?? socketAddressOf(c)
}

function socketAddressOf(c: Context): string | undefined {
  const bindings = c.env as NodeBindings | undefined
  return bindings?.incoming?.socket?.remoteAddress
}
