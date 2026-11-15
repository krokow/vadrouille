import { addDays, differenceInCalendarDays } from 'date-fns'
import { isoDay, toDate } from './format'

export type TripPhase = 'upcoming' | 'ongoing' | 'past' | 'undated'

export function tripPhase(start: string | null, end: string | null, today: Date = new Date()): TripPhase {
  if (!start) return 'undated'
  const t = isoDay(today)
  const e = end ?? start
  if (t < start) return 'upcoming'
  if (t > e) return 'past'
  return 'ongoing'
}

/** Jours restants avant le départ (0 = aujourd'hui), null si pas de date */
export function daysUntil(date: string | null, today: Date = new Date()): number | null {
  const d = toDate(date)
  return d ? differenceInCalendarDays(d, today) : null
}

export function countdownLabel(start: string | null, end: string | null, today: Date = new Date()): string {
  const phase = tripPhase(start, end, today)
  if (phase === 'undated') return 'Dates à définir'
  if (phase === 'past') return 'Terminé'
  if (phase === 'ongoing') {
    const day = differenceInCalendarDays(today, toDate(start)!) + 1
    const total = differenceInCalendarDays(toDate(end ?? start)!, toDate(start)!) + 1
    return `Jour ${day} / ${total}`
  }
  const n = daysUntil(start, today)!
  if (n === 1) return 'Demain !'
  return `J-${n}`
}

/** Liste des jours du voyage (yyyy-MM-dd), bornée à 60 jours */
export function tripDays(start: string | null, end: string | null): string[] {
  const s = toDate(start)
  if (!s) return []
  const e = toDate(end) ?? s
  const n = Math.min(Math.max(differenceInCalendarDays(e, s), 0), 59)
  return Array.from({ length: n + 1 }, (_, i) => isoDay(addDays(s, i)))
}

export type Urgency = 'overdue' | 'soon' | 'later' | 'none'

/** Urgence d'une date limite : dépassée, sous 7 jours, plus tard, ou sans date */
export function deadlineUrgency(deadline: string | null, today: Date = new Date(), soonDays = 7): Urgency {
  const n = daysUntil(deadline, today)
  if (n === null) return 'none'
  if (n < 0) return 'overdue'
  if (n <= soonDays) return 'soon'
  return 'later'
}

export function deadlineLabel(deadline: string | null, today: Date = new Date()): string {
  const n = daysUntil(deadline, today)
  if (n === null) return 'Sans date limite'
  if (n < -1) return `Dépassée de ${-n} jours`
  if (n === -1) return 'Dépassée depuis hier'
  if (n === 0) return "Aujourd'hui !"
  if (n === 1) return 'Demain'
  return `Dans ${n} jours`
}

const URGENCY_RANK: Record<Urgency, number> = { overdue: 0, soon: 1, later: 2, none: 3 }

/** Tri par urgence puis par date limite croissante */
export function compareByUrgency(a: string | null, b: string | null, today: Date = new Date()): number {
  const ua = URGENCY_RANK[deadlineUrgency(a, today)]
  const ub = URGENCY_RANK[deadlineUrgency(b, today)]
  if (ua !== ub) return ua - ub
  if (a && b) return a < b ? -1 : a > b ? 1 : 0
  return 0
}

/** Décale une date ISO de n jours */
export function shiftDay(d: string | null, n: number): string | null {
  const date = toDate(d)
  return date ? isoDay(addDays(date, n)) : null
}
