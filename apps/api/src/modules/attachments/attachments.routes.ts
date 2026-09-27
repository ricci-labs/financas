import type { AppEnv } from '@api/core/http/http.types'
import { currentSession } from '@api/core/http/middleware/session'
import { pathParams } from '@api/core/http/validation'
import { authorize, currentWorkspace } from '@api/modules/access'
import {
  fileResponseHeaders,
  receivedFileOf,
} from '@api/modules/attachments/attachments.middleware'
import {
  attachToEntry,
  detachFromEntry,
  listEntryAttachments,
  readFileContent,
} from '@api/modules/attachments/attachments.service'
import type { AttachmentRouteDeps } from '@api/modules/attachments/attachments.types'
import { entryAttachmentParamsSchema, entryParamsSchema, fileParamsSchema } from '@financas/shared'
import { Hono } from 'hono'

const OK = 200
const MULTIPART_OVERHEAD_BYTES = 16 * 1024
const CREATED = 201
const NO_CONTENT = 204

export const ATTACHMENT_UPLOAD_PATH = /^\/api\/workspaces\/[^/]+\/entries\/[^/]+\/attachments$/

export function uploadBodyLimitOf(fileMaxBytes: number): number {
  return fileMaxBytes + MULTIPART_OVERHEAD_BYTES
}

export function attachmentRoutes({ db, fileStorage, fileMaxBytes }: AttachmentRouteDeps) {
  const deps = { db, storage: fileStorage, maxBytes: fileMaxBytes }
  const entry = pathParams(entryParamsSchema, 'ENTRY_NOT_FOUND')
  const attachment = pathParams(entryAttachmentParamsSchema, 'ATTACHMENT_NOT_FOUND')
  const file = pathParams(fileParamsSchema, 'FILE_NOT_FOUND')

  return new Hono<AppEnv>()
    .get('/entries/:entryId/attachments', authorize('attachments', 'view'), entry, async (c) => {
      const { workspaceId } = currentWorkspace(c)
      const { entryId } = c.req.valid('param')
      return c.json(await listEntryAttachments(db, { workspaceId, entryId }))
    })
    .post('/entries/:entryId/attachments', authorize('attachments', 'create'), entry, async (c) => {
      const { workspaceId } = currentWorkspace(c)
      const { userId } = currentSession(c)
      const { entryId } = c.req.valid('param')
      const received = await receivedFileOf(c.req)
      const attached = await attachToEntry(
        deps,
        { workspaceId, userId, entryId },
        { ...received, source: 'web' },
      )
      return c.json(attached, CREATED)
    })
    .delete(
      '/entries/:entryId/attachments/:fileId',
      authorize('attachments', 'delete'),
      attachment,
      async (c) => {
        const { workspaceId } = currentWorkspace(c)
        const { userId } = currentSession(c)
        await detachFromEntry(db, { workspaceId, userId, ...c.req.valid('param') })
        return c.body(null, NO_CONTENT)
      },
    )
    .get('/files/:fileId', authorize('attachments', 'view'), file, async (c) => {
      const { workspaceId } = currentWorkspace(c)
      const content = await readFileContent(deps, { workspaceId, ...c.req.valid('param') })
      return c.body(content.bytes, OK, fileResponseHeaders(content))
    })
}
