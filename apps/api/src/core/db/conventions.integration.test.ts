import { connectTestDatabases } from '@api/testing/database'
import { sql } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'

const databases = connectTestDatabases()

const SOFT_DELETE_COLUMNS = ['deleted_at', 'deleted_by_user_id', 'delete_reason']

afterAll(async () => {
  await databases.closeAll()
})

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
})
