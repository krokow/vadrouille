import { useSyncExternalStore } from 'react'

export type ThemePref = 'light' | 'dark' | 'system'
const KEY = 'vadrouille-theme'
const listeners = new Set<() => void>()
const mq = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null

const readPref = (): ThemePref => {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

function apply() {
  const pref = readPref()
  const dark = pref === 'dark' || (pref === 'system' && !!mq?.matches)
  document.documentElement.classList.toggle('dark', dark)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#10181d' : '#1f6f8b')
  listeners.forEach((l) => l())
}
mq?.addEventListener('change', () => readPref() === 'system' && apply())

export function setThemePref(p: ThemePref) {
  try {
    if (p === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, p)
  } catch { /* ignore */ }
  apply()
}

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light') as 'light' | 'dark', () => 'light' as const)
  const pref = useSyncExternalStore(subscribe, readPref, () => 'system' as ThemePref)
  return { theme, pref, setPref: setThemePref, toggle: () => setThemePref(theme === 'dark' ? 'light' : 'dark') }
}
