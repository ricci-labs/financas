import { users } from '@api/modules/identity/identity.table'
import { connectTestDatabases } from '@api/testing/database'
import { createFixtures } from '@api/testing/fixtures'
import { eq, sql } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'

const databases = connectTestDatabases()
const fixtures = createFixtures(databases.owner, databases.app)

const SOFT_DELETE_COLUMNS = ['deleted_at', 'deleted_by_user_id', 'delete_reason']

afterAll(async () => {
  await fixtures.removeEverything()
  await databases.closeAll()
})

async function tablesWithUpdatedAtTrigger(): Promise<string[]> {
  const result = await databases.owner.execute<{ table_name: string }>(
    sql`select distinct c.relname as table_name
        from pg_trigger t
        join pg_class c on c.oid = t.tgrelid
        join pg_proc p on p.oid = t.tgfoid
        where p.proname = 'set_updated_at' and not t.tgisinternal
        order by table_name`,
  )
  return result.rows.map((row) => row.table_name)
}

async function tablesWithColumn(column: string): Promise<string[]> {
  const result = await databases.owner.execute<{ table_name: string }>(
    sql`select table_name from information_schema.columns
        where table_schema = 'public' and column_name = ${column}
        order by table_name`,
  )
  return result.rows.map((row) => row.table_name)
}

describe('table conventions', () => {
  it('give every soft-deletable table all the soft delete columns', async () => {
    const softDeletable = await tablesWithColumn('deleted_at')
    for (const column of SOFT_DELETE_COLUMNS) {
      expect({ column, tables: await tablesWithColumn(column) }).toEqual({
        column,
        tables: softDeletable,
      })
    }
  })

  it('give every table with updated_at the trigger that maintains it', async () => {
    expect(await tablesWithUpdatedAtTrigger()).toEqual(await tablesWithColumn('updated_at'))
  })

  it('bump updated_at on an update that does not set it', async () => {
    const userId = await fixtures.createUser('touched')
    await databases.owner.execute(
      sql`update users set display_name = 'Renamed' where id = ${userId}`,
    )
    const [user] = await databases.owner
      .select({ createdAt: users.createdAt, updatedAt: users.updatedAt })
      .from(users)
      .where(eq(users.id, userId))
    expect(user?.updatedAt.getTime()).toBeGreaterThan(user?.createdAt.getTime() ?? Infinity)
  })

  it('defer every non-cascading foreign key between tenant tables, so erasure works', async () => {
    const result = await databases.owner.execute<{ constraint_name: string }>(
      sql`select constraint_info.conname as constraint_name
          from pg_constraint constraint_info
          where constraint_info.contype = 'f'
            and constraint_info.confdeltype <> 'c'
            and not constraint_info.condeferrable
            and exists (
              select 1 from information_schema.columns
              where table_schema = 'public' and column_name = 'workspace_id'
                and table_name = constraint_info.conrelid::regclass::text
            )
            and exists (
              select 1 from information_schema.columns
              where table_schema = 'public' and column_name = 'workspace_id'
                and table_name = constraint_info.confrelid::regclass::text
            )
          order by constraint_name`,
    )
    expect(result.rows.map((row) => row.constraint_name)).toEqual([])
  })
})
