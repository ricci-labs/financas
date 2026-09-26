import type { Page, PageCursor } from '@shared/paging/paging.types'

export const PAGE_CURSOR_SEPARATOR = '_'

export const PAGE_CURSOR_MAX_LENGTH = 100

export const PAGE_DEFAULT_LIMIT = 100

export const PAGE_MAX_LIMIT = 500

export function encodePageCursor({ key, id }: PageCursor): string {
  return `${key}${PAGE_CURSOR_SEPARATOR}${id}`
}

export function pageOf<T>(rows: T[], limit: number, cursorOf: (row: T) => PageCursor): Page<T> {
  const items = rows.slice(0, limit)
  const last = items.at(-1)
  const hasMore = rows.length > limit && last !== undefined
  return { items, nextCursor: hasMore ? encodePageCursor(cursorOf(last)) : null }
}
