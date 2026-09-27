import { z } from 'zod'

export const fileParamsSchema = z.object({ fileId: z.uuid() })

export const attachmentTargetParamsSchema = z.object({ targetId: z.uuid() })

export const attachmentParamsSchema = z.object({ targetId: z.uuid(), fileId: z.uuid() })
