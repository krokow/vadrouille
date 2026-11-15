import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BellRing, CalendarDays, MapPin, Ticket, Users, Wallet, Map as MapIcon } from 'lucide-react'
import { useTrip } from './TripContext'
import { TripCover } from './TripCover'
import { WeatherCard } from './WeatherCard'
import { useTripTable } from '@/lib/data'
import { buildTodo, sortDay } from '@/features/activities/logic'
import { computeBalances } from '@/features/budget/logic'
import { countdownLabel, tripDays, tripPhase } from '@/lib/dates'
import { fmtDateRange, fmtDay, fmtDateTime, fmtMoney, fmtTime, isoDay } from '@/lib/format'
import { ACTIVITY_CATEGORIES, BOOKING_TYPES, BOOKING_STATUS } from '@/lib/constants'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
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
  const checklist = useTripTable(trip.id, 'checklist_items')
  const base = `/t/${trip.id}`
  const phase = tripPhase(trip.start_date, trip.end_date)

  const todo = useMemo(() => buildTodo(activities.data ?? [], bookings.data ?? []), [activities.data, bookings.data])
  // carte « À faire » : réservations + tâches d'avant départ (tant que le voyage n'est pas terminé)
  const todoAll = useMemo(
    () => buildTodo(activities.data ?? [], bookings.data ?? [], new Date(), phase === 'past' ? [] : checklist.data ?? []),
    [activities.data, bookings.data, checklist.data, phase],
  )
  const tasks = (checklist.data ?? []).filter((c) => c.kind === 'task')
  const packing = (checklist.data ?? []).filter((c) => c.kind !== 'task')

  const upcoming = useMemo(() => {
    const from = phase === 'upcoming' && trip.start_date ? trip.start_date : isoDay()
    const acts = sortDay((activities.data ?? []).filter((a) => a.day_date && a.day_date >= from))
      .map((a) => ({ key: `a${a.id}`, when: `${a.day_date}T${a.start_time ?? '12:00'}`, day: a.day_date!, time: a.start_time, at: null as string | null, title: a.title, emoji: ACTIVITY_CATEGORIES[a.category]?.emoji ?? '📍', to: `${base}/activities/${a.id}`, sub: null as string | null }))
    const books = (bookings.data ?? [])
      .filter((b) => b.start_at && b.start_at.slice(0, 10) >= from && b.status !== 'cancelled')
      .map((b) => ({ key: `b${b.id}`, when: b.start_at!, day: b.start_at!.slice(0, 10), time: null, at: b.start_at, title: b.title, emoji: BOOKING_TYPES[b.type].emoji, to: `${base}/bookings/${b.id}`, sub: b.confirmation_code }))
    return [...acts, ...books].sort((x, y) => (x.when < y.when ? -1 : 1)).slice(0, 8)
  }, [activities.data, bookings.data, phase, trip.start_date, base])

  const spent = (expenses.data ?? []).reduce((s, e) => s + Number(e.amount_main), 0)
  const planned = trip.total_budget ?? (budgets.data ?? []).reduce((s, b) => s + Number(b.planned_amount), 0)
  const balances = useMemo(
    () => computeBalances(members.map((m) => m.id), expenses.data ?? [], shares.data ?? [], settlements.data ?? []),
    [members, expenses.data, shares.data, settlements.data],
  )
  const myBalance = me ? balances[me.id] ?? 0 : 0
  const nDays = tripDays(trip.start_date, trip.end_date).length
  const planned_acts = (activities.data ?? []).filter((a) => a.day_date).length
  const ideas = (activities.data ?? []).length - planned_acts
  const confirmed = (bookings.data ?? []).filter((b) => b.status === 'booked' || b.status === 'confirmed')

  const stats = [
    { label: nDays ? 'jours' : 'dates', value: nDays || '?', to: `${base}/planning` },
    { label: 'activités', value: planned_acts, to: `${base}/planning` },
    { label: 'idées', value: ideas, to: `${base}/planning` },
    { label: 'à réserver', value: todo.length, to: `${base}/todo`, alert: todo.some((t) => t.urgency === 'overdue' || t.urgency === 'soon') },
    { label: 'dépensés', value: fmtMoney(spent, trip.currency, { compact: true }), to: `${base}/budget` },
  ]

  return (
    <div className="space-y-5">
      <TripCover trip={trip} className="-mx-4 -mt-4 h-48 sm:mx-0 sm:mt-0 sm:rounded-3xl lg:h-64">
        <div className="flex h-full flex-col justify-end p-5 text-white lg:p-7">
          <Badge className="mb-2 w-fit bg-white/20 text-white backdrop-blur">{countdownLabel(trip.start_date, trip.end_date)}</Badge>
          <h1 className="text-3xl font-extrabold drop-shadow lg:text-5xl">{trip.name}</h1>
          <p className="mt-1 flex items-center gap-1 text-sm opacity-90 lg:text-base">
            {trip.destination && <><MapPin className="h-4 w-4" />{trip.destination} · </>}{fmtDateRange(trip.start_date, trip.end_date)}
          </p>
        </div>
      </TripCover>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-5 sm:px-0">
        {stats.map((s) => (
          <Link key={s.label} to={s.to} className="min-w-[6.5rem] shrink-0 rounded-2xl border bg-card px-4 py-3 shadow-sm transition-colors hover:bg-accent/50">
            <p className={`text-2xl font-extrabold tabular ${s.alert ? 'text-coral' : ''}`}>{s.value}</p>
            <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
          </Link>
        ))}
      </div>

      <div className="lg:hidden"><WeatherCard trip={trip} compact /></div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 [&>*]:min-w-0">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BellRing className="h-4 w-4 text-coral" /> À faire / à réserver</CardTitle>
              <div className="flex gap-1">
                <Button asChild variant="ghost" size="sm"><Link to={`${base}/checklist`}>Préparatifs</Link></Button>
                {todo.length > 0 && <Button asChild variant="ghost" size="sm"><Link to={`${base}/todo`}>À réserver ({todo.length}) <ArrowRight /></Link></Button>}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {todoAll.length ? <TodoList items={todoAll.slice(0, 6)} compact /> : <p className="text-sm text-muted-foreground">Rien d’urgent, tout est sous contrôle 🙌</p>}
              {(tasks.length > 0 || packing.length > 0) && (
                <Link to={`${base}/checklist`} className="grid grid-cols-2 gap-3 rounded-2xl bg-muted/60 p-3 text-xs hover:bg-muted">
                  <span><span className="font-semibold">Avant le départ</span> · {tasks.filter((t) => t.done).length}/{tasks.length}<Gauge className="mt-1 h-1.5" value={tasks.filter((t) => t.done).length} max={Math.max(1, tasks.length)} label="Tâches faites" /></span>
                  <span><span className="font-semibold">À emporter</span> · {packing.filter((t) => t.done).length}/{packing.length}<Gauge className="mt-1 h-1.5" value={packing.filter((t) => t.done).length} max={Math.max(1, packing.length)} label="Affaires prêtes" /></span>
                </Link>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /> Prochaines étapes</CardTitle>
              <div className="flex gap-1">
                <Button asChild variant="ghost" size="sm"><Link to={`${base}/map`}><MapIcon /> Carte</Link></Button>
                <Button asChild variant="ghost" size="sm"><Link to={`${base}/planning`}>Planning <ArrowRight /></Link></Button>
              </div>
            </CardHeader>
            <CardContent>
              {upcoming.length ? (
                <ol className="grid gap-2 sm:grid-cols-2">
                  {upcoming.map((u) => (
                    <li key={u.key}>
                      <Link to={u.to} className="flex items-center gap-3 rounded-2xl border p-3 transition-colors hover:bg-accent/50">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-xl">{u.emoji}</span>
                        <span className="min-w-0">
                          <span className="block text-xs font-semibold text-muted-foreground first-letter:uppercase">{u.at ? fmtDateTime(u.at) : `${fmtDay(u.day)}${u.time ? ` · ${fmtTime(u.time)}` : ''}`}</span>
                          <span className="block truncate font-semibold">{u.title}</span>
                          {u.sub && <span className="block font-mono text-[11px] text-muted-foreground">{u.sub}</span>}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">Aucune activité planifiée à venir.</p>
              )}
            </CardContent>
          </Card>

          {confirmed.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Ticket className="h-4 w-4 text-coral" /> Réservations confirmées</CardTitle>
                <Button asChild variant="ghost" size="sm"><Link to={`${base}/bookings`}>Toutes <ArrowRight /></Link></Button>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2">
                {confirmed.slice(0, 4).map((b) => (
                  <Link key={b.id} to={`${base}/bookings/${b.id}`} className="flex items-center gap-3 rounded-2xl border p-3 hover:bg-accent/50">
                    <span className="text-xl">{BOOKING_TYPES[b.type].emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{b.title}</span>
                      <span className="block text-xs text-muted-foreground first-letter:uppercase">{b.start_at ? fmtDateTime(b.start_at) : BOOKING_STATUS[b.status].label}</span>
                    </span>
                    {b.confirmation_code && <span className="rounded-lg bg-muted px-2 py-0.5 font-mono text-xs font-bold">{b.confirmation_code}</span>}
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <div className="hidden lg:block"><WeatherCard trip={trip} /></div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Wallet className="h-4 w-4 text-success" /> Budget</CardTitle>
              <Button asChild variant="ghost" size="sm"><Link to={`${base}/budget`}>Détails <ArrowRight /></Link></Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-extrabold tabular">{fmtMoney(spent, trip.currency)}</span>
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> {members.length} participant{members.length > 1 ? 's' : ''}</CardTitle>
              <Button asChild variant="ghost" size="sm"><Link to={`${base}/members`}>Gérer <ArrowRight /></Link></Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {members.slice(0, 6).map((m) => {
                const b = balances[m.id] ?? 0
                return (
                  <div key={m.id} className="flex items-center gap-2 text-sm">
                    <Avatar name={m.display_name} color={m.color} size="sm" ghost={m.is_ghost} />
                    <span className="min-w-0 flex-1 truncate font-medium">{m.display_name}{m.id === me?.id && <span className="text-muted-foreground"> (toi)</span>}</span>
                    {Math.abs(b) >= 0.01 && <span className={`text-xs font-bold tabular ${b > 0 ? 'text-success' : 'text-coral'}`}>{b > 0 ? '+' : ''}{fmtMoney(b, trip.currency, { compact: true })}</span>}
                  </div>
                )
              })}
              {members.length > 6 && <p className="text-xs text-muted-foreground">+ {members.length - 6} autres</p>}
            </CardContent>
          </Card>

          {trip.notes && (
            <Card><CardHeader><CardTitle>📝 Infos utiles</CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap text-sm">{trip.notes}</p></CardContent></Card>
          )}
        </div>
      </div>
    </div>
  )
}
