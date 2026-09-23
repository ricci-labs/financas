import type { AppType } from '@api/app'
import { hc } from 'hono/client'

export const apiClient = hc<AppType>('/')
