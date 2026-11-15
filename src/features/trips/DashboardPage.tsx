import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, BellRing, CalendarDays, CloudSun, MapPin, Ticket, Users, Wallet } from 'lucide-react'
import { useTrip } from './TripContext'
import { TripCover } from './TripCover'
import { useTripTable } from '@/lib/data'
import { buildTodo, sortDay } from '@/features/activities/logic'
import { computeBalances } from '@/features/budget/logic'
import { countdownLabel, tripPhase } from '@/lib/dates'
import { fmtDateRange, fmtDay, fmtDateTime, fmtMoney, fmtTime, isoDay } from '@/lib/format'
import { forecast, weatherIcon } from '@/lib/weather'
import { ACTIVITY_CATEGORIES, BOOKING_TYPES } from '@/lib/constants'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AvatarStack } from '@/components/ui/avatar'
import { Gauge } from '@/components/ui/progress'
import { TodoList } from '@/features/activities/TodoList'

export default function DashboardPage() {
  const { trip, members, me } = useTrip()
  const activities = useTripTable(trip.id, 'activities')
  const bookings = useTripTable(trip.id, 'bookings')
  const expenses = useTripTable(trip.id, 'expenses')
  const shares = useTripTable(trip.id, 'expense_shares')
  const settlements = useTripTable(trip.id, 'settlements')
  const budgets = useTripTable(trip.id, 'budgets')
  const base = `/t/${trip.id}`
  const phase = tripPhase(trip.start_date, trip.end_date)

  const todo = useMemo(() => buildTodo(activities.data ?? [], bookings.data ?? []), [activities.data, bookings.data])

  // prochaines étapes : activités et réservations à partir d'aujourd'hui (ou du début du voyage)
  const upcoming = useMemo(() => {
    const from = phase === 'upcoming' && trip.start_date ? trip.start_date : isoDay()
    const acts = sortDay((activities.data ?? []).filter((a) => a.day_date && a.day_date >= from))
      .sort((a, b) => (a.day_date! < b.day_date! ? -1 : a.day_date! > b.day_date! ? 1 : 0))
      .map((a) => ({ key: `a${a.id}`, when: `${a.day_date}T${a.start_time ?? '12:00'}`, day: a.day_date!, time: a.start_time, at: null as string | null, title: a.title, emoji: ACTIVITY_CATEGORIES[a.category]?.emoji ?? '📍', to: `${base}/activities/${a.id}` }))
    const books = (bookings.data ?? [])
      .filter((b) => b.start_at && b.start_at.slice(0, 10) >= from && b.status !== 'cancelled')
      .map((b) => ({ key: `b${b.id}`, when: b.start_at!, day: b.start_at!.slice(0, 10), time: null, at: b.start_at, title: b.title, emoji: BOOKING_TYPES[b.type].emoji, to: `${base}/bookings/${b.id}` }))
    return [...acts, ...books].sort((x, y) => (x.when < y.when ? -1 : 1)).slice(0, 6)
  }, [activities.data, bookings.data, phase, trip.start_date, base])

  const spent = (expenses.data ?? []).reduce((s, e) => s + Number(e.amount_main), 0)
  const planned = trip.total_budget ?? (budgets.data ?? []).reduce((s, b) => s + Number(b.planned_amount), 0)
  const myBalance = useMemo(() => {
    if (!me) return 0
    return computeBalances(members.map((m) => m.id), expenses.data ?? [], shares.data ?? [], settlements.data ?? [])[me.id] ?? 0
  }, [me, members, expenses.data, shares.data, settlements.data])

  const weather = useQuery({
    queryKey: ['weather', trip.lat, trip.lng],
    queryFn: () => forecast(trip.lat!, trip.lng!),
    enabled: trip.lat != null && trip.lng != null && phase !== 'past',
    staleTime: 3 * 60 * 60_000,
  })
  const weatherDays = useMemo(() => {
    const list = weather.data ?? []
    const inTrip = trip.start_date ? list.filter((w) => w.date >= trip.start_date! && w.date <= (trip.end_date ?? trip.start_date!)) : []
    return (inTrip.length ? inTrip : list).slice(0, 7)
  }, [weather.data, trip.start_date, trip.end_date])
  const weatherIsTrip = !!trip.start_date && weatherDays.some((w) => w.date >= trip.start_date!)

  return (
    <div className="space-y-4">
      <TripCover trip={trip} className="-mx-4 -mt-4 h-44 sm:mx-0 sm:mt-0 sm:rounded-3xl lg:h-56">
        <div className="flex h-full flex-col justify-end p-4 text-white">
          <p className="text-sm font-semibold opacity-90">{countdownLabel(trip.start_date, trip.end_date)}</p>
          <h1 className="text-3xl font-bold drop-shadow">{trip.name}</h1>
          <p className="flex items-center gap-1 text-sm opacity-90">
            {trip.destination && <><MapPin className="h-3.5 w-3.5" />{trip.destination} · </>}{fmtDateRange(trip.start_date, trip.end_date)}
          </p>
        </div>
      </TripCover>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BellRing className="h-4 w-4 text-coral" /> À faire / à réserver</CardTitle>
            {todo.length > 0 && <Button asChild variant="ghost" size="sm"><Link to={`${base}/todo`}>Tout voir ({todo.length}) <ArrowRight /></Link></Button>}
          </CardHeader>
          <CardContent>
            {todo.length ? <TodoList items={todo.slice(0, 4)} compact /> : <p className="text-sm text-muted-foreground">Rien d’urgent, tout est sous contrôle 🙌</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /> Prochaines étapes</CardTitle>
            <Button asChild variant="ghost" size="sm"><Link to={`${base}/planning`}>Planning <ArrowRight /></Link></Button>
          </CardHeader>
          <CardContent>
            {upcoming.length ? (
              <ol className="relative space-y-3 border-l-2 border-dashed border-primary/30 pl-4">
                {upcoming.map((u) => (
                  <li key={u.key} className="relative">
                    <span className="absolute -left-[23px] top-1 h-3 w-3 rounded-full border-2 border-background bg-primary" />
                    <Link to={u.to} className="block hover:underline">
                      <p className="text-xs font-semibold first-letter:uppercase text-muted-foreground">{u.at ? fmtDateTime(u.at) : `${fmtDay(u.day)}${u.time ? ` · ${fmtTime(u.time)}` : ''}`}</p>
                      <p className="font-semibold">{u.emoji} {u.title}</p>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune activité planifiée à venir.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Wallet className="h-4 w-4 text-success" /> Budget</CardTitle>
            <Button asChild variant="ghost" size="sm"><Link to={`${base}/budget`}>Détails <ArrowRight /></Link></Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold tabular">{fmtMoney(spent, trip.currency)}</span>
              <span className="text-sm text-muted-foreground">{planned ? `sur ${fmtMoney(planned, trip.currency, { compact: true })}` : 'dépensés'}</span>
            </div>
            {planned > 0 && <Gauge value={spent} max={planned} label="Budget consommé" />}
            {me && Math.abs(myBalance) >= 0.01 && (
              <p className={myBalance > 0 ? 'text-sm font-semibold text-success' : 'text-sm font-semibold text-coral'}>
                {myBalance > 0 ? `On te doit ${fmtMoney(myBalance, trip.currency)}` : `Tu dois ${fmtMoney(-myBalance, trip.currency)}`}
              </p>
            )}
          </CardContent>
        </Card>

        {weatherDays.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><CloudSun className="h-4 w-4 text-warning" /> Météo {weatherIsTrip ? 'prévue' : 'actuelle sur place'}</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {weatherDays.map((w) => {
                  const wi = weatherIcon(w.code)
                  return (
                    <div key={w.date} className="flex min-w-[4.2rem] flex-col items-center rounded-2xl bg-muted/60 px-2 py-2 text-center" title={wi.label}>
                      <span className="text-[11px] font-semibold first-letter:uppercase text-muted-foreground">{fmtDay(w.date).split(' ').slice(0, 2).join(' ')}</span>
                      <span className="text-2xl">{wi.icon}</span>
                      <span className="text-xs font-bold">{w.tmax}°</span>
                      <span className="text-[11px] text-muted-foreground">{w.tmin}°</span>
                    </div>
                  )
                })}
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">Prévisions Open-Meteo (16 jours max)</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> {members.length} participant{members.length > 1 ? 's' : ''}</CardTitle>
            <Button asChild variant="ghost" size="sm"><Link to={`${base}/members`}>Gérer <ArrowRight /></Link></Button>
          </CardHeader>
          <CardContent>
            <AvatarStack people={members.map((m) => ({ id: m.id, name: m.display_name, color: m.color }))} max={8} size="md" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Ticket className="h-4 w-4 text-coral" /> Réservations</CardTitle>
            <Button asChild variant="ghost" size="sm"><Link to={`${base}/bookings`}>Voir <ArrowRight /></Link></Button>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {(bookings.data ?? []).filter((b) => b.status === 'booked' || b.status === 'confirmed').length} confirmée(s) · {(bookings.data ?? []).filter((b) => b.status === 'to_book').length} à réserver
          </CardContent>
        </Card>
      </div>

      {trip.notes && (
        <Card><CardHeader><CardTitle>📝 Infos utiles</CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap text-sm">{trip.notes}</p></CardContent></Card>
      )}
    </div>
  )
}
