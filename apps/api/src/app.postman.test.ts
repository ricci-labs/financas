import { readFileSync } from 'node:fs'
import { createApp } from '@api/app'
import { testAppDeps } from '@api/testing/app'
import type { PostmanItem } from '@api/testing/testing.types'
import { describe, expect, it } from 'vitest'

const COLLECTION_PATH = new URL(
  '../../../docs/api/financas.postman_collection.json',
  import.meta.url,
)
const MIDDLEWARE_METHOD = 'ALL'
const PATH_PARAMETER = /:\w+/g
const POSTMAN_VARIABLE = /\{\{\w+\}\}/g
const BASE_URL = '{{baseUrl}}'

function routeKey(method: string, path: string): string {
  return `${method} ${path.replaceAll(PATH_PARAMETER, '*')}`
}

function requestsOf(items: PostmanItem[]): { method: string; raw: string }[] {
  return items.flatMap((item) => {
    if (item.item) {
      return requestsOf(item.item)
    }
    return item.request ? [{ method: item.request.method, raw: item.request.url.raw }] : []
  })
}

function collectionRoutes(): Set<string> {
  const collection = JSON.parse(readFileSync(COLLECTION_PATH, 'utf8')) as { item: PostmanItem[] }
  return new Set(
    requestsOf(collection.item).map(({ method, raw }) => {
      const path = raw.replace(BASE_URL, '').split('?')[0] ?? ''
      return `${method} ${path.replaceAll(POSTMAN_VARIABLE, '*')}`
    }),
  )
}

function apiRoutes(): Set<string> {
  return new Set(
    createApp(testAppDeps())
      .routes.filter((route) => route.method !== MIDDLEWARE_METHOD)
      .map((route) => routeKey(route.method, route.path)),
  )
}

describe('the Postman collection', () => {
  it('has a request for every API route, and none for a route that is gone', () => {
    const inCollection = collectionRoutes()
    const inApi = apiRoutes()
    expect([...inApi].filter((route) => !inCollection.has(route))).toEqual([])
    expect([...inCollection].filter((route) => !inApi.has(route))).toEqual([])
  })
})
