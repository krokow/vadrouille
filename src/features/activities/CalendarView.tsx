import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useTrip } from '@/features/trips/TripContext'
import { useQuickAdd } from '@/features/trips/QuickAdd'
import { useTripTable } from '@/lib/data'
import { ACTIVITY_CATEGORIES, BOOKING_TYPES } from '@/lib/constants'
import { fmtTime, isoDay, toDate } from '@/lib/format'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { Activity } from '@/lib/types'
import { sortDay } from './logic'

interface Bar {
  id: string
  start: number
  end: number
  lane: number
  title: string
  emoji: string
  color: string
  status: string
}

/** Répartit des intervalles [start, end] en couloirs sans chevauchement */
export function packLanes<T extends { start: number; end: number }>(items: T[]): (T & { lane: number })[] {
  const lanesEnd: number[] = []
  return [...items]
    .sort((a, b) => a.start - b.start || b.end - a.end)
    .map((it) => {
      let lane = lanesEnd.findIndex((e) => e < it.start)
      if (lane === -1) lane = lanesEnd.length
      lanesEnd[lane] = it.end
      return { ...it, lane }
    })
}

/** Calendrier visuel : réservations en barres (multi-jours) + activités jour par jour */
export function CalendarView({ days }: { days: string[] }) {
  const { trip, canEdit } = useTrip()
  const quick = useQuickAdd()
  const bookings = useTripTable(trip.id, 'bookings')
  const activities = useTripTable(trip.id, 'activities')
  const base = `/t/${trip.id}`
  const today = isoDay()
  const index = useMemo(() => new Map(days.map((d, i) => [d, i])), [days])

  const bars: Bar[] = useMemo(() => {
    const raw = (bookings.data ?? [])
      .filter((b) => b.start_at && b.status !== 'cancelled')
      .map((b) => {
        const s = isoDay(new Date(b.start_at!))
        const e = b.end_at ? isoDay(new Date(b.end_at)) : s
        // borne aux jours affichés
        const start = index.get(s) ?? (s < days[0] ? 0 : -1)
        const end = index.get(e) ?? (e > days[days.length - 1] ? days.length - 1 : start)
        return { id: b.id, start, end: Math.max(start, end), title: b.title, emoji: BOOKING_TYPES[b.type].emoji, color: BOOKING_TYPES[b.type].color, status: b.status }
      })
      .filter((b) => b.start >= 0)
    return packLanes(raw)
  }, [bookings.data, index, days])
  const lanes = Math.max(0, ...bars.map((b) => b.lane + 1))

  const actsByDay = useMemo(() => {
    const out: Record<string, Activity[]> = {}
    for (const a of activities.data ?? []) if (a.day_date) (out[a.day_date] ??= []).push(a)
    for (const k of Object.keys(out)) out[k] = sortDay(out[k])
    return out
  }, [activities.data])

  const cols = `repeat(${days.length}, minmax(9.5rem, 1fr))`
  return (
    <div className="thin-scrollbar -mx-4 overflow-x-auto px-4 pb-3 lg:-mx-10 lg:px-10">
      <div className="min-w-max rounded-3xl border bg-card p-2" style={{ minWidth: '100%' }}>
        {/* en-tête des jours */}
        <div className="grid gap-1" style={{ gridTemplateColumns: cols }}>
          {days.map((d, i) => {
            const date = toDate(d)!
            const weekend = date.getDay() === 0 || date.getDay() === 6
            return (
              <div key={d} className={cn('rounded-2xl px-2 py-1.5 text-center', d === today ? 'bg-coral text-coral-foreground' : weekend ? 'bg-muted' : 'bg-muted/50')}>
                <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">J{i + 1} · {format(date, 'EEE', { locale: fr })}</p>
                <p className="text-sm font-extrabold">{format(date, 'd MMM', { locale: fr })}</p>
              </div>
            )
          })}
        </div>
        {/* réservations en barres */}
        {lanes > 0 && (
          <div className="mt-1 grid gap-1" style={{ gridTemplateColumns: cols, gridTemplateRows: `repeat(${lanes}, 2rem)` }}>
            {bars.map((b) => (
              <Link key={b.id} to={`${base}/bookings/${b.id}`} title={b.title}
                className={cn('flex min-w-0 items-center gap-1.5 rounded-xl px-2 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90', b.status === 'to_book' && 'opacity-60 outline-dashed outline-2 outline-offset-[-2px] outline-white/70')}
                style={{ gridColumn: `${b.start + 1} / ${b.end + 2}`, gridRow: b.lane + 1, backgroundColor: b.color }}>
                <span>{b.emoji}</span><span className="truncate">{b.title}</span>
              </Link>
            ))}
          </div>
        )}
        {/* activités */}
        <div className="mt-1 grid gap-1" style={{ gridTemplateColumns: cols }}>
          {days.map((d) => (
            <div key={d} className="group/day flex min-h-[8rem] flex-col gap-1 rounded-2xl border border-dashed p-1">
              {(actsByDay[d] ?? []).map((a) => (
                <Link key={a.id} to={`${base}/activities/${a.id}`} className="rounded-xl border bg-background px-2 py-1.5 text-xs shadow-sm hover:bg-accent/50">
                  <span className="flex items-center gap-1 font-bold">
                    {a.start_time && <span className="tabular text-primary">{fmtTime(a.start_time)}</span>}
                    {a.needs_booking && a.booking_status !== 'booked' && <span title="À réserver">⏳</span>}
                  </span>
                  <span className="line-clamp-2">{ACTIVITY_CATEGORIES[a.category]?.emoji} {a.title}</span>
                </Link>
              ))}
              {canEdit && (
                <button onClick={() => quick({ kind: 'activity', defaults: { day_date: d } })} aria-label="Ajouter une activité"
                  className="mt-auto flex items-center justify-center rounded-xl py-1 text-muted-foreground opacity-60 hover:bg-accent hover:opacity-100 group-hover/day:opacity-100">
                  <Plus className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Barres en pointillés = réservations encore à faire.</p>
    </div>
  )
}
