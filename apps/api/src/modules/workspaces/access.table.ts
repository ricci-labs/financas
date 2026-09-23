import { APP_MODULES, PERMISSION_ACTIONS } from '@financas/shared'
import { pgEnum, pgTable, primaryKey } from 'drizzle-orm/pg-core'

export const appModule = pgEnum('app_module', APP_MODULES)

export const permissionAction = pgEnum('permission_action', PERMISSION_ACTIONS)

export const moduleActions = pgTable(
  'module_actions',
  {
    module: appModule().notNull(),
    action: permissionAction().notNull(),
  },
  (table) => [primaryKey({ columns: [table.module, table.action] })],
)
