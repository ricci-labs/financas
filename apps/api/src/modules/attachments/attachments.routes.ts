import type { AppEnv } from '@api/core/http/http.types'
import { currentSession } from '@api/core/http/middleware/session'
import { pathParams } from '@api/core/http/validation'
import { authorize, currentWorkspace } from '@api/modules/access'
import {
  fileResponseHeaders,
  receivedFileOf,
} from '@api/modules/attachments/attachments.middleware'
import {
  attachFile,
  detachFile,
  listAttachments,
  readFileContent,
} from '@api/modules/attachments/attachments.service'
import type {
  AttachmentDeps,
  AttachmentRouteDeps,
  AttachmentTargetKind,
} from '@api/modules/attachments/attachments.types'
import {
  attachmentParamsSchema,
  attachmentTargetParamsSchema,
  fileParamsSchema,
} from '@financas/shared'
import { Hono } from 'hono'

const OK = 200
const CREATED = 201
const NO_CONTENT = 204
const MULTIPART_OVERHEAD_BYTES = 16 * 1024

export const ATTACHMENT_UPLOAD_PATH =
  /^\/api\/workspaces\/[^/]+\/(entries|charges)\/[^/]+\/attachments$/

export function uploadBodyLimitOf(fileMaxBytes: number): number {
  return fileMaxBytes + MULTIPART_OVERHEAD_BYTES
}

export function attachmentRoutes({ db, fileStorage, fileMaxBytes }: AttachmentRouteDeps) {
  const deps = { db, storage: fileStorage, maxBytes: fileMaxBytes }
  const file = pathParams(fileParamsSchema, 'FILE_NOT_FOUND')

  return new Hono<AppEnv>()
    .route('/entries', targetRoutes(deps, 'entry', 'ENTRY_NOT_FOUND'))
    .route('/charges', targetRoutes(deps, 'charge', 'CHARGE_NOT_FOUND'))
    .get('/files/:fileId', authorize('attachments', 'view'), file, async (c) => {
      const { workspaceId } = currentWorkspace(c)
      const content = await readFileContent(deps, { workspaceId, ...c.req.valid('param') })
      return c.body(content.bytes, OK, fileResponseHeaders(content))
    })
}

function targetRoutes(deps: AttachmentDeps, kind: AttachmentTargetKind, notFoundCode: string) {
  const target = pathParams(attachmentTargetParamsSchema, notFoundCode)
  const attachment = pathParams(attachmentParamsSchema, 'ATTACHMENT_NOT_FOUND')

  return new Hono<AppEnv>()
    .get('/:targetId/attachments', authorize('attachments', 'view'), target, async (c) => {
      const { workspaceId } = currentWorkspace(c)
      const { targetId } = c.req.valid('param')
      return c.json(await listAttachments(deps.db, { workspaceId, kind, targetId }))
    })
    .post('/:targetId/attachments', authorize('attachments', 'create'), target, async (c) => {
      const { workspaceId } = currentWorkspace(c)
      const { userId } = currentSession(c)
      const { targetId } = c.req.valid('param')
      const received = await receivedFileOf(c.req)
      const attached = await attachFile(
        deps,
        { workspaceId, userId, kind, targetId },
        { ...received, source: 'web' },
      )
      return c.json(attached, CREATED)
    })
    .delete(
      '/:targetId/attachments/:fileId',
      authorize('attachments', 'delete'),
      attachment,
      async (c) => {
        const { workspaceId } = currentWorkspace(c)
        const { userId } = currentSession(c)
        await detachFile(deps.db, { workspaceId, userId, kind, ...c.req.valid('param') })
        return c.body(null, NO_CONTENT)
      },
    )
}
