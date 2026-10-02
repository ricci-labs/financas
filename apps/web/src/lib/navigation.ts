const APP_PATH = /^\/(?!\/)/
const HOME_PATH = '/'

export function appPathOrHome(path: string | undefined): string {
  return path !== undefined && APP_PATH.test(path) && !path.includes('\\') ? path : HOME_PATH
}
