export function pageLink(publicUrl: string, path: string, token?: string): string {
  const url = new URL(path, publicUrl)
  if (token) {
    url.hash = new URLSearchParams({ token }).toString()
  }
  return url.toString()
}
