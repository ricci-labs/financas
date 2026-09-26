import { clientIpOf } from '@api/core/http/client-ip'
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'

async function ipSeenBy(
  trustedProxyHops: number,
  headers: Record<string, string>,
  socket?: string,
) {
  const app = new Hono().get('/', (c) => c.text(clientIpOf(c, trustedProxyHops)))
  const bindings = socket ? { incoming: { socket: { remoteAddress: socket } } } : undefined
  const response = await app.request('/', { headers }, bindings)
  return response.text()
}

describe('clientIpOf', () => {
  it('uses the socket address and ignores X-Forwarded-For when no proxy is trusted', async () => {
    expect(await ipSeenBy(0, { 'X-Forwarded-For': '198.51.100.7' }, '203.0.113.5')).toBe(
      '203.0.113.5',
    )
  })

  it('takes the address the trusted proxy saw, ignoring what the client wrote before it', async () => {
    const spoofed = { 'X-Forwarded-For': '10.0.0.1, 198.51.100.7' }
    expect(await ipSeenBy(1, spoofed, '172.18.0.2')).toBe('198.51.100.7')
  })

  it('counts hops from the right when there are two trusted proxies', async () => {
    const chain = { 'X-Forwarded-For': '10.0.0.1, 198.51.100.7, 172.18.0.9' }
    expect(await ipSeenBy(2, chain, '172.18.0.2')).toBe('198.51.100.7')
  })

  it('falls back to the socket when the header is missing', async () => {
    expect(await ipSeenBy(1, {}, '172.18.0.2')).toBe('172.18.0.2')
  })

  it('answers unknown for anything that is not an IP address', async () => {
    expect(await ipSeenBy(1, { 'X-Forwarded-For': 'not-an-ip' })).toBe('unknown')
    expect(await ipSeenBy(0, {})).toBe('unknown')
  })
})
