import { z } from 'zod'

export const fileParamsSchema = z.object({ fileId: z.uuid() })

export const entryAttachmentParamsSchema = z.object({ entryId: z.uuid(), fileId: z.uuid() })
