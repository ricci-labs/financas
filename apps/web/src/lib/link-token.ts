const TOKEN_PARAM = 'token'
const FRAGMENT_MARK = /^#/

export function tokenFromFragment(fragment: string): string | null {
  return new URLSearchParams(fragment.replace(FRAGMENT_MARK, '')).get(TOKEN_PARAM) || null
}
