/** Taux de change via frankfurter.app (BCE, gratuit, sans clé). Le taux est figé à la date de la dépense. */
const cache = new Map<string, number>()

export async function fetchRate(from: string, to: string, date?: string): Promise<number> {
  if (from === to) return 1
  const day = date && date <= new Date().toISOString().slice(0, 10) ? date : 'latest'
  const key = `${from}-${to}-${day}`
  const hit = cache.get(key)
  if (hit) return hit
  const res = await fetch(`https://api.frankfurter.app/${day}?from=${from}&to=${to}`)
  if (!res.ok) throw new Error(`Taux ${from}→${to} indisponible, saisis-le à la main`)
  const json = (await res.json()) as { rates: Record<string, number> }
  const rate = json.rates[to]
  if (!rate) throw new Error(`Devise ${from} ou ${to} non gérée, saisis le taux à la main`)
  cache.set(key, rate)
  return rate
}
