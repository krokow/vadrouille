import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeftRight, BedDouble, Camera, ChevronLeft, ChevronRight, Clock, MapPin, Navigation, Plus, Ticket, Zap } from 'lucide-react'
import { useTrip } from './TripContext'
import { useQuickAdd } from './QuickAdd'
import { useWeather } from './useWeather'
import { useTripTable } from '@/lib/data'
import { tripDays } from '@/lib/dates'
import { fmtDayLong, fmtMoney, fmtTime, isoDay } from '@/lib/format'
import { useNow } from '@/lib/hooks'
import { relativeDayLabel, upcomingDays, weatherIcon } from '@/lib/weather'
import { ACTIVITY_CATEGORIES, BOOKING_TYPES } from '@/lib/constants'
import { indexBy } from '@/lib/utils'
import { sortDay } from '@/features/activities/logic'
import { CurrencyConverter } from '@/features/budget/CurrencyConverter'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import type { Place } from '@/lib/types'

interface Item {
  key: string
  at: Date | null
  end: Date | null
  title: string
  emoji: string
  place?: Place
  to: string
  ticket?: string
  code?: string | null
}

const directions = (p: Place) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=walking`

function countdown(ms: number): string {
  const min = Math.round(ms / 60_000)
  if (min < 1) return 'maintenant'
  if (min < 60) return `dans ${min} min`
  const h = Math.floor(min / 60)
  return `dans ${h} h ${String(min % 60).padStart(2, '0')}`
}

/** Mode « Jour J » : la journée en cours, pensée pour le téléphone sur place */
export default function TodayPage() {
  const { trip, canEdit } = useTrip()
  const quick = useQuickAdd()
  const now = useNow(30_000)
  const activities = useTripTable(trip.id, 'activities')
  const bookings = useTripTable(trip.id, 'bookings')
  const places = useTripTable(trip.id, 'places')
  const expenses = useTripTable(trip.id, 'expenses')
  const weather = useWeather(trip)
  const days = useMemo(() => tripDays(trip.start_date, trip.end_date), [trip.start_date, trip.end_date])
  const today = isoDay()
  const [day, setDay] = useState(() => (days.includes(today) ? today : days[0] ?? today))
  const idx = days.indexOf(day)
  const isToday = day === today
  const placeById = indexBy(places.data)
  const base = `/t/${trip.id}`

  const items: Item[] = useMemo(() => {
    const list: Item[] = []
    for (const a of sortDay((activities.data ?? []).filter((x) => x.day_date === day))) {
      list.push({
        key: `a${a.id}`, at: a.start_time ? new Date(`${day}T${a.start_time}`) : null, end: a.end_time ? new Date(`${day}T${a.end_time}`) : null,
        title: a.title, emoji: ACTIVITY_CATEGORIES[a.category]?.emoji ?? '📍', place: a.place_id ? placeById[a.place_id] : undefined, to: `${base}/activities/${a.id}`,
      })
    }
    for (const b of bookings.data ?? []) {
      if (b.status === 'cancelled') continue
      const sDay = b.start_at ? isoDay(new Date(b.start_at)) : null
      const eDay = b.end_at ? isoDay(new Date(b.end_at)) : null
      const place = b.place_id ? placeById[b.place_id] : undefined
      if (sDay === day) list.push({ key: `bs${b.id}`, at: new Date(b.start_at!), end: b.end_at && eDay === day ? new Date(b.end_at) : null, title: b.type === 'lodging' ? `Arrivée · ${b.title}` : b.title, emoji: BOOKING_TYPES[b.type].emoji, place, to: `${base}/bookings/${b.id}`, ticket: `${base}/bookings/${b.id}/ticket`, code: b.confirmation_code })
      else if (eDay === day && (b.type === 'lodging' || b.type === 'car')) list.push({ key: `be${b.id}`, at: new Date(b.end_at!), end: null, title: `${b.type === 'lodging' ? 'Départ' : 'Retour'} · ${b.title}`, emoji: BOOKING_TYPES[b.type].emoji, place, to: `${base}/bookings/${b.id}`, code: b.confirmation_code })
    }
    // horodatés d'abord, dans l'ordre ; sans heure à la fin
    return list.sort((x, y) => (x.at && y.at ? x.at.getTime() - y.at.getTime() : x.at ? -1 : y.at ? 1 : 0))
  }, [activities.data, bookings.data, day, placeById, base])

  const lodging = useMemo(() => (bookings.data ?? []).find((b) => b.type === 'lodging' && b.status !== 'cancelled' && b.start_at && isoDay(new Date(b.start_at)) <= day && (!b.end_at || isoDay(new Date(b.end_at)) > day)), [bookings.data, day])
  const next = isToday ? items.find((i) => i.at && (i.end ?? i.at).getTime() > now) ?? items.find((i) => !i.at) : items[0]
  const spentToday = (expenses.data ?? []).filter((e) => e.date === day).reduce((s, e) => s + Number(e.amount_main), 0)
  const f = weather.data
  const dayWeather = upcomingDays(f).find((w) => w.date === day)

  if (!days.length) return <EmptyState icon={Clock} title="Pas encore de dates" description="Ajoute les dates du voyage pour profiter de la vue du jour." />

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* en-tête du jour */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Jour précédent" disabled={idx <= 0} onClick={() => setDay(days[idx - 1])}><ChevronLeft /></Button>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-coral">{isToday ? 'Aujourd’hui' : idx >= 0 ? `Jour ${idx + 1} / ${days.length}` : ''}{isToday && idx >= 0 ? ` · Jour ${idx + 1} / ${days.length}` : ''}</p>
          <h1 className="truncate text-2xl font-extrabold first-letter:uppercase">{fmtDayLong(day)}</h1>
        </div>
        <Button variant="outline" size="icon" aria-label="Jour suivant" disabled={idx >= days.length - 1} onClick={() => setDay(days[idx + 1])}><ChevronRight /></Button>
      </div>
      {!isToday && days.includes(today) && <button onClick={() => setDay(today)} className="mx-auto block text-xs font-semibold text-primary">Revenir à aujourd’hui</button>}

      {/* météo + actions rapides */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="col-span-2 flex items-center gap-3 p-3">
          {f && isToday ? (
            <>
              <span className="text-4xl">{weatherIcon(f.current.code, f.current.isDay).icon}</span>
              <div className="min-w-0">
                <p className="text-2xl font-extrabold leading-none">{f.current.temp}°</p>
                <p className="truncate text-xs text-muted-foreground">{weatherIcon(f.current.code).label}{dayWeather ? ` · ${dayWeather.tmin}°/${dayWeather.tmax}°` : ''}{dayWeather && dayWeather.rain >= 30 ? ` · 💧${dayWeather.rain} %` : ''}</p>
              </div>
            </>
          ) : dayWeather ? (
            <>
              <span className="text-4xl">{weatherIcon(dayWeather.code).icon}</span>
              <div>
                <p className="text-2xl font-extrabold leading-none">{dayWeather.tmax}°<span className="text-base text-muted-foreground">/{dayWeather.tmin}°</span></p>
                <p className="text-xs text-muted-foreground">{relativeDayLabel(day, f!.localToday) ?? 'Prévision'} · {weatherIcon(dayWeather.code).label}</p>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Météo disponible 16 jours avant.</p>
          )}
        </Card>
        {canEdit && (
          <button onClick={() => quick({ kind: 'quick-expense' })} className="flex flex-col items-center justify-center gap-1 rounded-2xl border bg-card p-3 text-xs font-semibold shadow-sm active:scale-95">
            <Zap className="h-5 w-5 text-warning" /> Dépense
            {spentToday > 0 && <span className="text-[10px] font-normal text-muted-foreground">{fmtMoney(spentToday, trip.currency, { compact: true })} aujourd’hui</span>}
          </button>
        )}
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex flex-col items-center justify-center gap-1 rounded-2xl border bg-card p-3 text-xs font-semibold shadow-sm active:scale-95"><ArrowLeftRight className="h-5 w-5 text-primary" /> Convertir</button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-4"><CurrencyConverter /></PopoverContent>
        </Popover>
      </div>

      {/* prochaine étape */}
      {next ? (
        <Card className="overflow-hidden border-primary/30">
          <div className="bg-primary/10 px-4 py-2 text-xs font-bold uppercase tracking-wide text-primary">
            {isToday ? (next.at ? `Prochaine étape · ${next.at.getTime() > now ? countdown(next.at.getTime() - now) : 'en cours'}` : 'À faire aujourd’hui') : 'Première étape'}
          </div>
          <CardContent className="space-y-3 p-4">
            <Link to={next.to} className="flex items-start gap-3">
              <span className="text-4xl">{next.emoji}</span>
              <div className="min-w-0">
                <p className="text-xl font-bold leading-tight">{next.title}</p>
                <p className="text-sm text-muted-foreground">{next.at ? fmtTime(next.at.toTimeString().slice(0, 5)) : 'Sans horaire'}{next.place ? ` · ${next.place.name}` : ''}</p>
                {next.code && <p className="mt-1 inline-block rounded-lg bg-muted px-2 py-0.5 font-mono text-xs font-bold">{next.code}</p>}
              </div>
            </Link>
            <div className="flex flex-wrap gap-2">
              {next.place && <Button asChild><a href={directions(next.place)} target="_blank" rel="noreferrer"><Navigation /> Y aller</a></Button>}
              {next.ticket && <Button asChild variant="coral"><Link to={next.ticket}><Ticket /> Billet</Link></Button>}
              <Button asChild variant="outline"><Link to={next.to}>Détails</Link></Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState icon={Clock} title="Journée libre" description={isToday ? 'Plus rien de prévu aujourd’hui. Profitez !' : 'Rien de planifié ce jour-là.'}
          action={canEdit && <Button onClick={() => quick({ kind: 'activity', defaults: { day_date: day } })}><Plus /> Ajouter une activité</Button>} />
      )}

      {/* fil de la journée */}
      {items.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Programme de la journée</CardTitle></CardHeader>
          <CardContent>
            <ol className="relative space-y-1 border-l-2 border-muted pl-5">
              {items.map((it, i) => {
                const past = isToday && !!it.at && (it.end ?? it.at).getTime() < now
                const showNow = isToday && it.at && it.at.getTime() > now && (i === 0 || !items[i - 1].at || items[i - 1].at!.getTime() <= now)
                return (
                  <li key={it.key}>
                    {showNow && (
                      <div className="relative -ml-5 mb-1 flex items-center gap-2 py-1 text-[11px] font-bold text-coral">
                        <span className="-ml-[7px] h-3 w-3 rounded-full bg-coral ring-4 ring-coral/20" /> Maintenant · {new Date(now).toTimeString().slice(0, 5).replace(':', 'h')}
                      </div>
                    )}
                    <Link to={it.to} className={cn('relative flex items-center gap-3 rounded-xl p-2 hover:bg-accent/50', past && 'opacity-50')}>
                      <span className={cn('absolute -left-[27px] h-3 w-3 rounded-full border-2 border-background', past ? 'bg-muted-foreground' : 'bg-primary')} />
                      <span className="w-12 shrink-0 text-xs font-bold tabular">{it.at ? fmtTime(it.at.toTimeString().slice(0, 5)) : '—'}</span>
                      <span className="text-lg">{it.emoji}</span>
                      <span className="min-w-0 flex-1">
                        <span className={cn('block truncate text-sm font-semibold', past && 'line-through')}>{it.title}</span>
                        {it.place && <span className="block truncate text-xs text-muted-foreground"><MapPin className="mr-0.5 inline h-3 w-3" />{it.place.name}</span>}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* hébergement du soir */}
      {lodging && (
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <BedDouble className="h-6 w-6 shrink-0 text-[#8e6bbf]" />
            <Link to={`${base}/bookings/${lodging.id}`} className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Ce soir on dort à</p>
              <p className="truncate font-semibold">{lodging.title}</p>
              {lodging.confirmation_code && <p className="font-mono text-xs">{lodging.confirmation_code}</p>}
            </Link>
            {lodging.place_id && placeById[lodging.place_id] && (
              <Button asChild variant="outline" size="sm"><a href={directions(placeById[lodging.place_id])} target="_blank" rel="noreferrer"><Navigation /> Rentrer</a></Button>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Button asChild variant="outline"><Link to={`${base}/map`}><MapPin /> Carte du jour</Link></Button>
        <Button asChild variant="outline"><Link to={`${base}/album`}><Camera /> Album photo</Link></Button>
      </div>
    </div>
  )
}
