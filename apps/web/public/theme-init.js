const THEME_STORAGE_KEY = 'theme'
const DARK_THEME = 'dark'
const LIGHT_THEME = 'light'
const SYSTEM_PREFERS_DARK = '(prefers-color-scheme: dark)'

function readStoredTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY)
  } catch {
    return null
  }
}

function shouldUseDarkTheme(storedTheme) {
  if (storedTheme === DARK_THEME || storedTheme === LIGHT_THEME) {
    return storedTheme === DARK_THEME
  }
  return window.matchMedia(SYSTEM_PREFERS_DARK).matches
}

const usesDarkTheme = shouldUseDarkTheme(readStoredTheme())
document.documentElement.classList.toggle(DARK_THEME, usesDarkTheme)
document.documentElement.style.colorScheme = usesDarkTheme ? DARK_THEME : LIGHT_THEME
