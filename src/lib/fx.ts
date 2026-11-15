/**
 * Taux de change via frankfurter.app (BCE, gratuit, sans clé). Le taux d'une dépense est figé à sa date.
 * Les derniers taux sont gardés dans le navigateur pour fonctionner hors ligne.
 */
const memory = new Map<string, number>()
const STORE = 'vadrouille-fx'

type Stored = Record<string, { rate: number; day: string; at: number }>

function readStore(): Stored {
  try {
    return JSON.parse(localStorage.getItem(STORE) || '{}') as Stored
  } catch {
    return {}
  }
}
function writeStore(pair: string, rate: number, day: string) {
  try {
    const s = readStore()
    s[pair] = { rate, day, at: Date.now() }
    localStorage.setItem(STORE, JSON.stringify(s))
  } catch { /* stockage indisponible */ }
}

/** Dernier taux connu hors ligne pour une paire (ou null) */
export function cachedRate(from: string, to: string): { rate: number; day: string } | null {
  if (from === to) return { rate: 1, day: '' }
  const hit = readStore()[`${from}-${to}`]
  if (hit) return { rate: hit.rate, day: hit.day }
  const inv = readStore()[`${to}-${from}`]
  return inv ? { rate: 1 / inv.rate, day: inv.day } : null
}

export async function fetchRate(from: string, to: string, date?: string): Promise<number> {
  if (from === to) return 1
  const day = date && date <= new Date().toISOString().slice(0, 10) ? date : 'latest'
  const key = `${from}-${to}-${day}`
  const hit = memory.get(key)
  if (hit) return hit
  try {
    const res = await fetch(`https://api.frankfurter.app/${day}?from=${from}&to=${to}`)
    if (!res.ok) throw new Error(`Taux ${from}→${to} indisponible, saisis-le à la main`)
    const json = (await res.json()) as { date?: string; rates: Record<string, number> }
    const rate = json.rates[to]
    if (!rate) throw new Error(`Devise ${from} ou ${to} non gérée, saisis le taux à la main`)
    memory.set(key, rate)
    writeStore(`${from}-${to}`, rate, json.date ?? day)
    return rate
  } catch (e) {
    // hors ligne : dernier taux connu
    const c = cachedRate(from, to)
    if (c && (typeof navigator !== 'undefined' && !navigator.onLine)) return c.rate
    throw e
  }
}
