import type { LOGIN_NOTICES, loginSearchSchema } from '@web/features/auth/auth.schemas'
import type { z } from 'zod'

export type LoginNotice = (typeof LOGIN_NOTICES)[number]

export type LoginSearch = z.infer<typeof loginSearchSchema>
