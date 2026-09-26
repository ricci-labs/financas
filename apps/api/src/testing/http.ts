import type { Database } from '@api/core/db/db.types'
import { withWorkspace } from '@api/core/db/tx'
import { roles } from '@api/modules/access/access.table'
import { createUser } from '@api/modules/identity'
import { addMember } from '@api/modules/members'
import { TEST_PUBLIC_URL } from '@api/testing/app'
import type { SessionRequests, TestApp, TestSession } from '@api/testing/testing.types'
import type { SystemRoleKey } from '@financas/shared'
import { and, eq } from 'drizzle-orm'

const PASSWORD = 'a long enough password'
const FAST_COST = { cpuMemoryCost: 2 ** 10, blockSize: 8, parallelization: 1 }
const SESSION_COOKIE = /^session=([\w-]{43});/

export async function loggedInUser(
  app: TestApp,
  appDb: Database,
  runId: string,
  label: string,
): Promise<TestSession> {
  const email = `${label}-${crypto.randomUUID()}-${runId}@example.test`
  const userId = await createUser(
    appDb,
    { email, displayName: `Member ${label}`, password: PASSWORD, isEmailVerified: true },
    { passwordCost: FAST_COST },
  )
  const response = await app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: TEST_PUBLIC_URL },
    body: JSON.stringify({ email, password: PASSWORD }),
  })
  const token = response.headers.get('Set-Cookie')?.match(SESSION_COOKIE)?.[1]
  if (!token) {
    throw new Error(`Login failed for ${label}`)
  }
  return { userId, cookie: `session=${token}` }
}

export function requestsAs(app: TestApp, session: TestSession): SessionRequests {
  const send = async (method: string, path: string, body?: unknown) =>
    app.request(path, {
      method,
      headers: {
        Cookie: session.cookie,
        Origin: TEST_PUBLIC_URL,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  return {
    get: (path) => send('GET', path),
    post: (path, body) => send('POST', path, body),
    patch: (path, body) => send('PATCH', path, body),
    put: (path, body) => send('PUT', path, body),
    del: (path, body) => send('DELETE', path, body),
  }
}

export async function addMemberWithSystemRole(
  appDb: Database,
  ownerDb: Database,
  workspaceId: string,
  userId: string,
  systemKey: SystemRoleKey,
): Promise<string> {
  const [role] = await ownerDb
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.workspaceId, workspaceId), eq(roles.systemKey, systemKey)))
  if (!role) {
    throw new Error(`Workspace ${workspaceId} has no ${systemKey} role`)
  }
  return withWorkspace(appDb, workspaceId, (tx) =>
    addMember(tx, { workspaceId, userId, roleId: role.id }),
  )
}
