import { z } from 'zod'

export const WORKSPACE_NAME_MAX_LENGTH = 80

export const workspaceNameSchema = z.string().trim().min(1).max(WORKSPACE_NAME_MAX_LENGTH)

export const workspaceIdSchema = z.uuid()
