import { useLayoutEffect } from 'react'

const DARK_CLASS = 'dark'
const LIGHT_SCHEME = 'light'

export function useLightTheme() {
  useLayoutEffect(() => {
    const root = document.documentElement
    const wasDark = root.classList.contains(DARK_CLASS)
    const previousScheme = root.style.colorScheme
    root.classList.remove(DARK_CLASS)
    root.style.colorScheme = LIGHT_SCHEME
    return () => {
      root.classList.toggle(DARK_CLASS, wasDark)
      root.style.colorScheme = previousScheme
    }
  }, [])
}
