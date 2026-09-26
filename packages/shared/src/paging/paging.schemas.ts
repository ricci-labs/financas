import { PAGE_CURSOR_MAX_LENGTH, PAGE_CURSOR_SEPARATOR } from '@shared/paging/paging'
import { z } from 'zod'

export function pageCursorSchema(keySchema: z.ZodType<string, string>) {
  return z
    .string()
    .max(PAGE_CURSOR_MAX_LENGTH)
    .transform((cursor) => {
      const separatorAt = cursor.lastIndexOf(PAGE_CURSOR_SEPARATOR)
      return { key: cursor.slice(0, Math.max(separatorAt, 0)), id: cursor.slice(separatorAt + 1) }
    })
    .pipe(z.object({ key: keySchema, id: z.uuid() }))
}
