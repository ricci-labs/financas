import { encodePageCursor, pageOf } from '@shared/paging/paging'
import { pageCursorSchema, pageLimitSchema } from '@shared/paging/paging.schemas'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

const ID = '01900000-0000-7000-8000-000000000001'
const cursorOf = (row: { day: string; id: string }) => ({ key: row.day, id: row.id })
const rows = [
  { day: '2026-10-03', id: ID },
  { day: '2026-10-02', id: ID },
  { day: '2026-10-01', id: ID },
]

describe('pageOf', () => {
  it('keeps the limit and points the cursor at the last row kept when there is more', () => {
    expect(pageOf(rows, 2, cursorOf)).toEqual({
      items: rows.slice(0, 2),
      nextCursor: `2026-10-02_${ID}`,
    })
  })

  it('has no cursor on the last page', () => {
    expect(pageOf(rows, 3, cursorOf).nextCursor).toBeNull()
    expect(pageOf([], 3, cursorOf)).toEqual({ items: [], nextCursor: null })
  })
})

describe('pageCursorSchema', () => {
  const schema = pageCursorSchema(z.iso.date())

  it('reads back the cursor it wrote, even when the key holds the separator', () => {
    expect(schema.parse(encodePageCursor({ key: '2026-10-02', id: ID }))).toEqual({
      key: '2026-10-02',
      id: ID,
    })
    const withSeparator = pageCursorSchema(z.string().min(1))
    expect(withSeparator.parse(`a_b_${ID}`)).toEqual({ key: 'a_b', id: ID })
  })

  it('refuses a cursor without separator, a bad key, a bad id or one too long', () => {
    for (const cursor of [ID, `2026-13-01_${ID}`, '2026-10-02_nope', `${'9'.repeat(100)}_${ID}`]) {
      expect(schema.safeParse(cursor).success).toBe(false)
    }
  })
})

describe('pageLimitSchema', () => {
  it('reads the limit from a query string, defaults it and caps it', () => {
    expect(pageLimitSchema.parse('20')).toBe(20)
    expect(pageLimitSchema.parse(undefined)).toBe(100)
    expect(pageLimitSchema.safeParse('501').success).toBe(false)
    expect(pageLimitSchema.safeParse('0').success).toBe(false)
  })
})
