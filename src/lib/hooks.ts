import { useEffect, useState } from 'react'

export function useOnline() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

export function useMediaQuery(q: string) {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const cb = () => setMatch(m.matches)
    m.addEventListener('change', cb)
    return () => m.removeEventListener('change', cb)
  }, [q])
  return match
}

/** Re-render périodique (pour « il y a 2 min ») */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

/** Garde l'écran allumé (mode billet) quand le navigateur le permet */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    const request = () =>
      navigator.wakeLock.request('screen').then((l) => (lock = l)).catch(() => undefined)
    void request()
    const onVis = () => document.visibilityState === 'visible' && void request()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      void lock?.release()
    }
  }, [active])
}
