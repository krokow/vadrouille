import { CloudSun, Droplets, Wind } from 'lucide-react'
import type { Trip } from '@/lib/types'
import { fmtDay } from '@/lib/format'
import { relativeDayLabel, upcomingDays, weatherIcon } from '@/lib/weather'
import { tripPhase } from '@/lib/dates'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useWeather } from './useWeather'

/** Météo : conditions actuelles sur place + prochains jours (ou jours du voyage s'ils sont dans les 16 jours) */
export function WeatherCard({ trip, compact }: { trip: Trip; compact?: boolean }) {
  const q = useWeather(trip, tripPhase(trip.start_date, trip.end_date) !== 'past')
  if (trip.lat == null || trip.lng == null) return null
  if (q.isLoading) return <Skeleton className={compact ? 'h-20' : 'h-56'} />
  if (!q.data) return null
  const f = q.data
  const all = upcomingDays(f)
  const inTrip = trip.start_date ? all.filter((d) => d.date >= trip.start_date! && d.date <= (trip.end_date ?? trip.start_date!)) : []
  const days = (inTrip.length ? inTrip : all).slice(0, compact ? 5 : 7)
  const now = weatherIcon(f.current.code, f.current.isDay)
  const place = trip.destination?.split(',')[0] ?? 'sur place'
  const [hh, mm] = f.current.time ? f.current.time.slice(11, 16).split(':') : []
  const localTime = hh ? `${Number(hh)}h${mm}` : null

  if (compact) {
    return (
      <Card className="flex items-center gap-3 overflow-x-auto p-3">
        <div className="flex shrink-0 items-center gap-2 pr-2">
          <span className="text-3xl">{now.icon}</span>
          <div>
            <p className="text-xl font-extrabold leading-none">{f.current.temp}°</p>
            <p className="text-[11px] text-muted-foreground">{place}</p>
          </div>
        </div>
        {days.slice(0, 5).map((d) => (
          <div key={d.date} className="flex shrink-0 flex-col items-center text-center">
            <span className="text-[10px] font-semibold text-muted-foreground">{relativeDayLabel(d.date, f.localToday)?.replace("Aujourd'hui", 'Auj.') ?? fmtDay(d.date).split(' ')[0]}</span>
            <span className="text-lg leading-tight">{weatherIcon(d.code).icon}</span>
            <span className="text-[11px] font-bold">{d.tmax}°<span className="font-normal text-muted-foreground">/{d.tmin}°</span></span>
          </div>
        ))}
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-br from-primary/90 to-primary/60 p-4 text-primary-foreground">
        <div className="flex items-start justify-between gap-2">
          <p className="flex min-w-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-wide opacity-90"><CloudSun className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">Météo · {place}</span></p>
          {localTime && <p className="shrink-0 text-xs opacity-90">Il est {localTime} sur place</p>}
        </div>
        <div className="mt-2 flex items-center gap-3">
          <span className="text-5xl leading-none">{now.icon}</span>
          <div>
            <p className="text-4xl font-extrabold leading-none">{f.current.temp}°</p>
            <p className="text-sm opacity-90">{now.label} · ressenti {f.current.feels}°</p>
          </div>
        </div>
        <div className="mt-3 flex gap-4 text-xs opacity-90">
          <span className="flex items-center gap-1"><Wind className="h-3.5 w-3.5" />{f.current.wind} km/h</span>
          <span className="flex items-center gap-1"><Droplets className="h-3.5 w-3.5" />{f.current.humidity} %</span>
        </div>
      </div>
      <CardHeader className="pb-1 pt-3">
        <CardTitle className="text-sm">{inTrip.length ? 'Pendant le voyage' : 'Prochains jours'}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {days.map((d) => {
            const wi = weatherIcon(d.code)
            const rel = relativeDayLabel(d.date, f.localToday)
            return (
              <li key={d.date} className="flex items-center gap-3 py-1.5 text-sm" title={wi.label}>
                <span className={cn('w-24 shrink-0 font-semibold first-letter:uppercase', rel && 'text-primary')}>{rel ?? fmtDay(d.date)}</span>
                <span className="text-xl">{wi.icon}</span>
                <span className="flex-1 truncate text-xs text-muted-foreground">{wi.label}{d.rain >= 30 ? ` · 💧${d.rain} %` : ''}</span>
                <span className="font-bold tabular">{d.tmax}°</span>
                <span className="w-8 text-right text-muted-foreground tabular">{d.tmin}°</span>
              </li>
            )
          })}
        </ul>
        {!inTrip.length && trip.start_date && trip.start_date > (all.at(-1)?.date ?? '') && (
          <p className="mt-2 text-[11px] text-muted-foreground">Les prévisions du voyage apparaîtront 16 jours avant le départ.</p>
        )}
        <p className="mt-1 text-[10px] text-muted-foreground">Données Open-Meteo</p>
      </CardContent>
    </Card>
  )
}
