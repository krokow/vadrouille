/**
 * Géocodage via Photon (komoot, basé sur OpenStreetMap, gratuit, sans clé).
 * Politique d'usage respectée : debounce côté UI + file d'attente à 1 requête/seconde + cache mémoire.
 */
export interface GeoResult {
  id: string
  name: string
  label: string
  lat: number
  lng: number
  osm_id: string | null
  kind: string | null
}

const cache = new Map<string, GeoResult[]>()
let last = 0
let chain: Promise<unknown> = Promise.resolve()

function throttle<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = Math.max(0, last + 1000 - Date.now())
    if (wait) await new Promise((r) => setTimeout(r, wait))
    last = Date.now()
    return fn()
  })
  chain = run.catch(() => undefined)
  return run
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] }
  properties: {
    osm_id?: number; osm_type?: string; name?: string; street?: string; housenumber?: string
    city?: string; state?: string; country?: string; postcode?: string; osm_value?: string; type?: string
  }
}

export function featureToResult(f: PhotonFeature): GeoResult {
  const p = f.properties
  const street = [p.housenumber, p.street].filter(Boolean).join(' ')
  const name = p.name || street || p.city || p.country || 'Lieu'
  const parts = [p.name && street ? street : null, p.city !== name ? p.city : null, p.country !== name ? p.country : null]
  return {
    id: `${p.osm_type ?? ''}${p.osm_id ?? Math.random()}`,
    name,
    label: parts.filter(Boolean).join(', '),
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
    osm_id: p.osm_id ? `${p.osm_type ?? ''}${p.osm_id}` : null,
    kind: p.osm_value ?? p.type ?? null,
  }
}

export async function geocode(query: string, opts?: { near?: { lat: number; lng: number }; signal?: AbortSignal }): Promise<GeoResult[]> {
  const q = query.trim()
  if (q.length < 3) return []
  const key = `${q.toLowerCase()}|${opts?.near ? `${opts.near.lat.toFixed(1)},${opts.near.lng.toFixed(1)}` : ''}`
  const hit = cache.get(key)
  if (hit) return hit
  return throttle(async () => {
    const url = new URL('https://photon.komoot.io/api/')
    url.searchParams.set('q', q)
    url.searchParams.set('limit', '6')
    url.searchParams.set('lang', 'fr')
    if (opts?.near) {
      url.searchParams.set('lat', String(opts.near.lat))
      url.searchParams.set('lon', String(opts.near.lng))
    }
    const res = await fetch(url, { signal: opts?.signal })
    if (!res.ok) throw new Error('Recherche de lieu indisponible')
    const json = (await res.json()) as { features: PhotonFeature[] }
    const out = json.features.map(featureToResult)
    cache.set(key, out)
    return out
  })
}

/** Liens externes pour ouvrir un lieu dans une app de navigation */
export function mapsLinks(lat: number, lng: number, name?: string) {
  const q = encodeURIComponent(name ?? `${lat},${lng}`)
  return {
    google: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}${name ? `&query_place_id=&q=${q}` : ''}`,
    apple: `https://maps.apple.com/?ll=${lat},${lng}&q=${q}`,
    osm: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`,
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeoResult | null> {
  return throttle(async () => {
    const res = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=fr&limit=1`)
    if (!res.ok) return null
    const json = (await res.json()) as { features: PhotonFeature[] }
    const f = json.features[0]
    return f ? { ...featureToResult(f), lat, lng } : null
  })
}

/** Itinéraire routier via le serveur public OSRM (usage modéré, optionnel) */
export async function osrmRoute(points: { lat: number; lng: number }[], profile: 'driving' | 'foot' = 'driving'): Promise<{ coords: [number, number][]; km: number; minutes: number } | null> {
  if (points.length < 2) return null
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(';')
  const host = profile === 'foot' ? 'https://routing.openstreetmap.de/routed-foot' : 'https://router.project-osrm.org'
  const res = await fetch(`${host}/route/v1/${profile === 'foot' ? 'foot' : 'driving'}/${coords}?overview=full&geometries=geojson`)
  if (!res.ok) throw new Error('Calcul d’itinéraire indisponible')
  const json = await res.json()
  const r = json.routes?.[0]
  if (!r) return null
  return {
    coords: (r.geometry.coordinates as [number, number][]).map(([lng, lat]) => [lat, lng]),
    km: r.distance / 1000,
    minutes: r.duration / 60,
  }
}

/** Distance à vol d'oiseau (km) */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}
