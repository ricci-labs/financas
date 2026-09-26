export type PageCursor = {
  key: string
  id: string
}

export type Page<T> = {
  items: T[]
  nextCursor: string | null
}
