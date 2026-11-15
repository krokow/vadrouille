import { differenceInCalendarDays } from 'date-fns'
import { backend } from '@/lib/backend'
import { uid, randomToken } from '@/lib/ids'
import { shiftDay } from '@/lib/dates'
import { toDate } from '@/lib/format'
import type { Trip } from '@/lib/types'

/**
 * Duplique un voyage comme modèle : lieux, activités (jours décalés), liens, budget prévisionnel et checklist.
 * Les dépenses, réservations et participants ne sont pas copiés.
 */
export async function duplicateTrip(source: Trip, opts: { name: string; startDate: string | null; userId: string }): Promise<string> {
  const id = uid()
  const offset = source.start_date && opts.startDate ? differenceInCalendarDays(toDate(opts.startDate)!, toDate(source.start_date)!) : 0
  const length = source.start_date && source.end_date ? differenceInCalendarDays(toDate(source.end_date)!, toDate(source.start_date)!) : 0
  await backend.insert('trips', {
    id, name: opts.name, destination: source.destination, lat: source.lat, lng: source.lng,
    start_date: opts.startDate, end_date: opts.startDate ? shiftDay(opts.startDate, length) : null,
    currency: source.currency, cover_url: null, invite_token: randomToken(), invite_enabled: true,
    total_budget: source.total_budget, notes: source.notes, created_by: opts.userId,
  })
  const [places, activities, links, budgets, checklist] = await Promise.all([
    backend.select('places', { trip_id: source.id }),
    backend.select('activities', { trip_id: source.id }),
    backend.select('activity_links', { trip_id: source.id }),
    backend.select('budgets', { trip_id: source.id }),
    backend.select('checklist_items', { trip_id: source.id }),
  ])
  const placeMap = new Map(places.map((p) => [p.id, uid()]))
  const actMap = new Map(activities.map((a) => [a.id, uid()]))
  const strip = <T extends { id: string; created_at?: string; updated_at?: string; updated_by?: string | null }>(r: T) => {
    const { created_at: _c, updated_at: _u, updated_by: _b, ...rest } = r
    return rest
  }
  if (places.length) await backend.insert('places', places.map((p) => ({ ...strip(p), id: placeMap.get(p.id)!, trip_id: id })))
  if (activities.length)
    await backend.insert('activities', activities.map((a) => ({
      ...strip(a), id: actMap.get(a.id)!, trip_id: id,
      place_id: a.place_id ? placeMap.get(a.place_id) ?? null : null,
      day_date: offset && a.day_date ? shiftDay(a.day_date, offset) : opts.startDate ? a.day_date : null,
      booking_status: a.needs_booking ? ('to_book' as const) : null,
      booking_deadline: a.booking_deadline && offset ? shiftDay(a.booking_deadline, offset) : null,
      linked_booking_id: null,
    })))
  const validLinks = links.filter((l) => actMap.has(l.activity_id))
  if (validLinks.length)
    await backend.insert('activity_links', validLinks.map((l) => ({ ...strip(l), id: uid(), trip_id: id, activity_id: actMap.get(l.activity_id)! })))
  if (budgets.length) await backend.insert('budgets', budgets.map((b) => ({ ...strip(b), id: uid(), trip_id: id })))
  if (checklist.length)
    await backend.insert('checklist_items', checklist.map((c) => ({ ...strip(c), id: uid(), trip_id: id, done: false, assigned_to: null })))
  return id
}
