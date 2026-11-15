/**
 * Suggestions de lieux autour d'un point via l'API Overpass (OpenStreetMap, gratuite, sans clé).
 * Usage modéré : uniquement sur demande, résultats mis en cache.
 */
import type { ActivityCategory } from './types'
import { haversineKm } from './geocode'

export type SuggestCategory = 'top' | 'museum' | 'viewpoint' | 'food' | 'cafe' | 'bar' | 'park'

export const SUGGEST_CATEGORIES: Record<SuggestCategory, { label: string; emoji: string; filters: string[]; activity: ActivityCategory }> = {
  top: { label: 'Incontournables', emoji: '⭐', activity: 'visit', filters: ['["tourism"~"^(attraction|museum|viewpoint|gallery|zoo|theme_park)$"]["wikidata"]', '["historic"~"^(castle|monument|memorial|ruins|archaeological_site|fort)$"]["wikidata"]', '["amenity"="place_of_worship"]["wikidata"]["building"~"cathedral|church|temple|mosque|shrine"]'] },
  museum: { label: 'Musées', emoji: '🏛️', activity: 'culture', filters: ['["tourism"~"^(museum|gallery)$"]'] },
  viewpoint: { label: 'Points de vue', emoji: '🌄', activity: 'nature', filters: ['["tourism"="viewpoint"]'] },
  food: { label: 'Restos', emoji: '🍽️', activity: 'food', filters: ['["amenity"="restaurant"]'] },
  cafe: { label: 'Cafés', emoji: '☕', activity: 'food', filters: ['["amenity"~"^(cafe|ice_cream)$"]', '["shop"~"^(bakery|pastry)$"]'] },
  bar: { label: 'Bars', emoji: '🍸', activity: 'nightlife', filters: ['["amenity"~"^(bar|pub|biergarten)$"]'] },
  park: { label: 'Parcs & jardins', emoji: '🌳', activity: 'nature', filters: ['["leisure"~"^(park|garden|nature_reserve)$"]["name"]'] },
}

export interface Suggestion {
  id: string
  name: string
  lat: number
  lng: number
  km: number
  kind: string | null
  cuisine: string | null
  website: string | null
  famous: boolean
  address: string | null
  opening_hours: string | null
}

interface OverpassEl {
  type: string
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

const cache = new Map<string, Suggestion[]>()

export async function suggestAround(cat: SuggestCategory, center: { lat: number; lng: number }, radiusM = 1500): Promise<Suggestion[]> {
  const key = `${cat}|${center.lat.toFixed(3)},${center.lng.toFixed(3)}|${radiusM}`
  const hit = cache.get(key)
  if (hit) return hit
  const around = `(around:${radiusM},${center.lat.toFixed(5)},${center.lng.toFixed(5)})`
  const body = `[out:json][timeout:20];(${SUGGEST_CATEGORIES[cat].filters.map((f) => `nwr${f}["name"]${around};`).join('')});out center tags 80;`
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(body)}`,
  })
  if (!res.ok) throw new Error(res.status === 429 ? 'Trop de recherches, réessaie dans une minute' : 'Suggestions indisponibles')
  const json = (await res.json()) as { elements: OverpassEl[] }
  const out = json.elements
    .map((e): Suggestion | null => {
      const lat = e.lat ?? e.center?.lat
      const lng = e.lon ?? e.center?.lon
      const t = e.tags ?? {}
      if (lat == null || lng == null || !t.name) return null
      const name = t['name:fr'] ?? t.name
      const street = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ')
      return {
        id: `${e.type}${e.id}`, name, lat, lng, km: haversineKm(center, { lat, lng }),
        kind: t.tourism ?? t.historic ?? t.amenity ?? t.leisure ?? t.shop ?? null,
        cuisine: t.cuisine?.replace(/;/g, ', ').replace(/_/g, ' ') ?? null,
        website: t.website ?? t['contact:website'] ?? null,
        famous: !!(t.wikidata || t.wikipedia),
        address: [street, t['addr:city']].filter(Boolean).join(', ') || null,
        opening_hours: t.opening_hours ?? null,
      }
    })
    .filter((s): s is Suggestion => !!s)
  // dédoublonne par nom, populaires d'abord puis par distance
  const seen = new Set<string>()
  const result = out
    .sort((a, b) => Number(b.famous) - Number(a.famous) || a.km - b.km)
    .filter((s) => (seen.has(s.name.toLowerCase()) ? false : (seen.add(s.name.toLowerCase()), true)))
    .slice(0, 40)
  cache.set(key, result)
  return result
}
