import type { Activity, Booking, ChecklistItem } from '@/lib/types'
import { compareByUrgency, deadlineUrgency, type Urgency } from '@/lib/dates'

export interface TodoItem {
  kind: 'activity' | 'booking' | 'task'
  id: string
  title: string
  deadline: string | null
  /** date à laquelle l'élément a lieu (jour de l'activité / début de la réservation) */
  when: string | null
  urgency: Urgency
}

/**
 * Tout ce qui reste à réserver : activités « à réserver » + réservations au statut « à réserver ».
 * Sans date limite explicite, on prend la date de l'activité elle-même comme échéance.
 */
export function buildTodo(activities: Activity[], bookings: Booking[], today: Date = new Date(), tasks: ChecklistItem[] = []): TodoItem[] {
  const items: TodoItem[] = []
  for (const t of tasks) {
    if (t.kind !== 'task' || t.done) continue
    const deadline = t.due_date ?? null
    items.push({ kind: 'task', id: t.id, title: t.label, deadline, when: null, urgency: deadlineUrgency(deadline, today) })
  }
  for (const a of activities) {
    if (!a.needs_booking || a.booking_status === 'booked') continue
    const deadline = a.booking_deadline ?? a.day_date
    items.push({ kind: 'activity', id: a.id, title: a.title, deadline, when: a.day_date, urgency: deadlineUrgency(deadline, today) })
  }
  for (const b of bookings) {
    if (b.status !== 'to_book') continue
    const when = b.start_at ? b.start_at.slice(0, 10) : null
    const deadline = b.booking_deadline ?? when
    items.push({ kind: 'booking', id: b.id, title: b.title, deadline, when, urgency: deadlineUrgency(deadline, today) })
  }
  return items.sort((x, y) => compareByUrgency(x.deadline, y.deadline, today) || x.title.localeCompare(y.title))
}

/** Activités d'un jour, triées par heure puis par ordre manuel */
export function sortDay(list: Activity[]): Activity[] {
  return [...list].sort((a, b) => {
    if (a.start_time && b.start_time && a.start_time !== b.start_time) return a.start_time < b.start_time ? -1 : 1
    return a.sort_order - b.sort_order
  })
}
