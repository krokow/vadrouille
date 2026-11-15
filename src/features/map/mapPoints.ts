import type { Activity, Booking, Place } from '@/lib/types'
import { ACTIVITY_CATEGORIES, BOOKING_TYPES } from '@/lib/constants'

export type PointKind = 'activity' | 'lodging' | 'transport' | 'food' | 'other'

export const POINT_KINDS: Record<PointKind, { label: string; color: string; emoji: string }> = {
  activity: { label: 'Activités', color: '#1f6f8b', emoji: '🎯' },
  lodging: { label: 'Hébergements', color: '#8e6bbf', emoji: '🏨' },
  transport: { label: 'Transports', color: '#3c9d9b', emoji: '🚆' },
  food: { label: 'Restos', color: '#ef7b62', emoji: '🍽️' },
  other: { label: 'Autres', color: '#5b8e7d', emoji: '📍' },
}

export interface MapPoint {
  key: string
  place: Place
  kind: PointKind
  emoji: string
  title: string
  day: string | null
  sort: string
  to: string | null
  status?: string
}

/** Rassemble tous les lieux du voyage (activités, réservations, lieux seuls) en points de carte */
export function buildPoints(base: string, places: Place[], activities: Activity[], bookings: Booking[]): MapPoint[] {
  const byId = new Map(places.map((p) => [p.id, p]))
  const used = new Set<string>()
  const out: MapPoint[] = []
  for (const a of activities) {
    const place = a.place_id ? byId.get(a.place_id) : undefined
    if (!place) continue
    used.add(place.id)
    out.push({
      key: `a-${a.id}`, place, kind: a.category === 'food' ? 'food' : 'activity',
      emoji: ACTIVITY_CATEGORIES[a.category]?.emoji ?? '📍', title: a.title, day: a.day_date,
      sort: `${a.day_date ?? '9999'}-${a.start_time ?? '99'}-${String(a.sort_order).padStart(12, '0')}`,
      to: `${base}/activities/${a.id}`,
    })
  }
  for (const b of bookings) {
    const place = b.place_id ? byId.get(b.place_id) : undefined
    if (!place || b.status === 'cancelled') continue
    used.add(place.id)
    const kind: PointKind = b.type === 'lodging' ? 'lodging' : b.type === 'restaurant' ? 'food' : ['flight', 'train', 'bus', 'car'].includes(b.type) ? 'transport' : b.type === 'ticket' ? 'activity' : 'other'
    out.push({
      key: `b-${b.id}`, place, kind, emoji: BOOKING_TYPES[b.type].emoji, title: b.title,
      day: b.start_at ? b.start_at.slice(0, 10) : null, sort: b.start_at ?? '9999', to: `${base}/bookings/${b.id}`, status: b.status,
    })
  }
  for (const p of places) {
    if (!used.has(p.id)) out.push({ key: `p-${p.id}`, place: p, kind: 'other', emoji: '📍', title: p.name, day: null, sort: '9999', to: null })
  }
  return out
}
