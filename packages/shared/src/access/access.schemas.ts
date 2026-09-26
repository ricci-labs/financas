import { isValidPermission, missingViewPermissions } from '@shared/access/access'
import { APP_MODULES, PERMISSION_ACTIONS } from '@shared/access/access.constants'
import { deletionRequestSchema } from '@shared/deletion/deletion.schemas'
import { z } from 'zod'

export const memberParamsSchema = z.object({ membershipId: z.uuid() })

export const memberRoleChangeSchema = z.object({ roleId: z.uuid() })

export const memberRemovalSchema = deletionRequestSchema

export const ROLE_NAME_MAX_LENGTH = 60

export const ROLE_DESCRIPTION_MAX_LENGTH = 200

const permissionSchema = z.object({
  module: z.enum(APP_MODULES),
  action: z.enum(PERMISSION_ACTIONS),
})

const permissionsSchema = z
  .array(permissionSchema)
  .refine((permissions) => permissions.every(isValidPermission), {
    message: 'A permission does not exist for its module',
  })
  .refine((permissions) => missingViewPermissions(permissions).length === 0, {
    message: 'Every module with an action needs view',
  })
  .transform((permissions) => [
    ...new Map(
      permissions.map((permission) => [`${permission.module}:${permission.action}`, permission]),
    ).values(),
  ])

export const roleParamsSchema = z.object({ roleId: z.uuid() })

export const newRoleSchema = z.object({
  name: z.string().trim().min(1).max(ROLE_NAME_MAX_LENGTH),
  description: z.string().trim().max(ROLE_DESCRIPTION_MAX_LENGTH).nullish(),
  permissions: permissionsSchema,
})

export const roleChangeSchema = z
  .object({
    name: z.string().trim().min(1).max(ROLE_NAME_MAX_LENGTH).optional(),
    description: z.string().trim().max(ROLE_DESCRIPTION_MAX_LENGTH).nullish(),
    permissions: permissionsSchema.optional(),
  })
  .refine((change) => Object.values(change).some((value) => value !== undefined), {
    message: 'Nothing to change',
  })

export type MemberParams = z.infer<typeof memberParamsSchema>
export type MemberRoleChange = z.infer<typeof memberRoleChangeSchema>
export type NewRole = z.infer<typeof newRoleSchema>
export type RoleChange = z.infer<typeof roleChangeSchema>
