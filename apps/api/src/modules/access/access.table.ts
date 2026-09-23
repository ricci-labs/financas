import { primaryId, softDelete, timestamps } from '@api/core/db/columns'
import { tenantIsolation } from '@api/core/db/tenancy'
import { users } from '@api/modules/identity/identity.table'
import { workspaces } from '@api/modules/workspaces/workspaces.table'
import { APP_MODULES, PERMISSION_ACTIONS, SYSTEM_ROLE_KEYS } from '@financas/shared'
import { sql } from 'drizzle-orm'
import {
  foreignKey,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export const appModule = pgEnum('app_module', APP_MODULES)

export const permissionAction = pgEnum('permission_action', PERMISSION_ACTIONS)

export const systemRoleKey = pgEnum('system_role_key', SYSTEM_ROLE_KEYS)

export const moduleActions = pgTable(
  'module_actions',
  {
    module: appModule().notNull(),
    action: permissionAction().notNull(),
  },
  (table) => [primaryKey({ columns: [table.module, table.action] })],
)

export const roles = pgTable(
  'roles',
  {
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    id: primaryId(),
    name: text().notNull(),
    systemKey: systemRoleKey(),
    description: text(),
    ...softDelete(() => users.id),
    ...timestamps(),
  },
  (table) => [
    unique('roles_workspace_id_id_unique').on(table.workspaceId, table.id),
    uniqueIndex('roles_name_unique')
      .on(table.workspaceId, sql`lower(${table.name})`)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex('roles_system_key_unique')
      .on(table.workspaceId, table.systemKey)
      .where(sql`${table.systemKey} is not null and ${table.deletedAt} is null`),
    tenantIsolation('roles', table.workspaceId),
  ],
).enableRLS()

export const rolePermissions = pgTable(
  'role_permissions',
  {
    workspaceId: uuid().notNull(),
    roleId: uuid().notNull(),
    module: appModule().notNull(),
    action: permissionAction().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.roleId, table.module, table.action] }),
    foreignKey({
      name: 'role_permissions_role_fk',
      columns: [table.workspaceId, table.roleId],
      foreignColumns: [roles.workspaceId, roles.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'role_permissions_module_action_fk',
      columns: [table.module, table.action],
      foreignColumns: [moduleActions.module, moduleActions.action],
    }),
    tenantIsolation('role_permissions', table.workspaceId),
  ],
).enableRLS()
