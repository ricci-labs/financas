import { pageCursorSchema, pageLimitSchema } from '@shared/core/paging/paging.schemas'
import { z } from 'zod'

const TABLE_NAME_MAX_LENGTH = 63

export const auditQuerySchema = z.object({
  tableName: z.string().min(1).max(TABLE_NAME_MAX_LENGTH).optional(),
  rowId: z.uuid().optional(),
  cursor: pageCursorSchema(z.iso.datetime()).optional(),
  limit: pageLimitSchema,
})

export type AuditQuery = z.infer<typeof auditQuerySchema>
