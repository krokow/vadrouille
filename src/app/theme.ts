import { useSyncExternalStore } from 'react'

type Theme = 'light' | 'dark'
const KEY = 'vadrouille-theme'
const listeners = new Set<() => void>()

const read = (): Theme => (document.documentElement.classList.contains('dark') ? 'dark' : 'light')

export function setTheme(t: Theme) {
  document.documentElement.classList.toggle('dark', t === 'dark')
  localStorage.setItem(KEY, t)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#10181d' : '#1f6f8b')
  listeners.forEach((l) => l())
}

export function useTheme() {
  const theme = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    read,
    () => 'light' as Theme,
  )
  return { theme, toggle: () => setTheme(theme === 'dark' ? 'light' : 'dark') }
}
