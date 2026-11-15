import type { Activity, Booking, Trip } from '@/lib/types'
import { downloadFile } from '@/lib/utils'

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
const stampUtc = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const dateOnly = (iso: string) => iso.replace(/-/g, '')
const localDT = (day: string, time: string) => `${dateOnly(day)}T${time.replace(/:/g, '').slice(0, 4)}00`

function nextDay(day: string) {
  const d = new Date(`${day}T12:00:00`)
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

/** Génère un fichier .ics (RFC 5545) avec les activités planifiées et les réservations datées */
export function buildIcs(trip: Trip, activities: Activity[], bookings: Booking[]): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Vadrouille//FR', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${esc(trip.name)}`]
  const now = stampUtc(new Date())
  const push = (uid: string, summary: string, start: string, end: string, allDay: boolean, desc?: string | null) => {
    lines.push('BEGIN:VEVENT', `UID:${uid}@vadrouille`, `DTSTAMP:${now}`)
    lines.push(allDay ? `DTSTART;VALUE=DATE:${start}` : `DTSTART:${start}`)
    lines.push(allDay ? `DTEND;VALUE=DATE:${end}` : `DTEND:${end}`)
    lines.push(`SUMMARY:${esc(summary)}`)
    if (desc) lines.push(`DESCRIPTION:${esc(desc)}`)
    lines.push('END:VEVENT')
  }
  if (trip.start_date) push(trip.id, `✈️ ${trip.name}`, dateOnly(trip.start_date), dateOnly(nextDay(trip.end_date ?? trip.start_date)), true, trip.destination)
  for (const a of activities) {
    if (!a.day_date) continue
    if (a.start_time) {
      const end = a.end_time ?? a.start_time
      push(a.id, a.title, localDT(a.day_date, a.start_time), localDT(a.day_date, end), false, a.description)
    } else push(a.id, a.title, dateOnly(a.day_date), dateOnly(nextDay(a.day_date)), true, a.description)
  }
  for (const b of bookings) {
    if (!b.start_at || b.status === 'cancelled') continue
    const s = new Date(b.start_at)
    const e = b.end_at ? new Date(b.end_at) : new Date(s.getTime() + 60 * 60_000)
    const desc = [b.confirmation_code && `Confirmation : ${b.confirmation_code}`, b.notes].filter(Boolean).join('\n')
    push(b.id, `🎫 ${b.title}`, stampUtc(s), stampUtc(e), false, desc)
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

export function exportIcs(trip: Trip, activities: Activity[], bookings: Booking[]) {
  const slug = trip.name.normalize('NFD').replace(/[^\w]+/g, '-').toLowerCase()
  downloadFile(`${slug}.ics`, buildIcs(trip, activities, bookings), 'text/calendar;charset=utf-8')
}
