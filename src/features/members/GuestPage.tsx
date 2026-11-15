import 'leaflet/dist/leaflet.css'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import L from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import { CalendarDays, Eye, Map as MapIcon, MapPin, Ticket } from 'lucide-react'
import { backend } from '@/lib/backend'
import { tripDays, countdownLabel } from '@/lib/dates'
import { fmtDateRange, fmtDateTime, fmtDayLong, fmtTime, isoDay } from '@/lib/format'
import { ACTIVITY_CATEGORIES, BOOKING_TYPES } from '@/lib/constants'
import type { ActivityCategory, BookingType } from '@/lib/types'
import { resolveTile } from '@/features/map/tiles'
import { useTheme } from '@/app/theme'
import { Wordmark } from '@/components/Logo'
import { AvatarStack } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MapLinks } from '@/components/MapLinks'

interface PublicTrip {
  trip: { id: string; name: string; destination: string | null; lat: number | null; lng: number | null; start_date: string | null; end_date: string | null }
  members: { id: string; display_name: string; color: string }[]
  places: { id: string; name: string; address: string | null; lat: number; lng: number }[]
  activities: { id: string; title: string; description: string | null; day_date: string | null; start_time: string | null; end_time: string | null; category: ActivityCategory; place_id: string | null; sort_order: number }[]
  bookings: { id: string; title: string; type: BookingType; start_at: string | null; end_at: string | null; status: string; place_id: string | null }[]
}

/** /#/share/:token — consultation sans compte, en lecture seule */
export function GuestPage() {
  const { token = '' } = useParams()
  const { theme } = useTheme()
  const q = useQuery({
    queryKey: ['public-trip', token],
    queryFn: () => backend.rpc<PublicTrip>('public_trip', { token }),
    retry: false,
    refetchInterval: 60_000,
    meta: { persist: false },
  })
  const [tab, setTab] = useState('program')
  const data = q.data
  const placeById = useMemo(() => Object.fromEntries((data?.places ?? []).map((p) => [p.id, p])), [data])
  const days = useMemo(() => {
    if (!data) return []
    const s = new Set(tripDays(data.trip.start_date, data.trip.end_date))
    data.activities.forEach((a) => a.day_date && s.add(a.day_date))
    return [...s].sort()
  }, [data])

  if (q.isLoading) return <div className="mx-auto max-w-3xl space-y-4 p-4"><Skeleton className="h-32" /><Skeleton className="h-64" /></div>
  if (!data) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center p-6 paper">
        <Wordmark className="mb-6" />
        <EmptyState icon={Eye} title="Lien de partage invalide" description="Il a peut-être été désactivé par l’organisateur du voyage." className="max-w-sm" />
      </div>
    )
  }
  const t = data.trip
  const today = isoDay()
  const tile = resolveTile('auto', theme === 'dark')
  const mapped = data.places

  return (
    <div className="min-h-dvh paper">
      <header className="border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <Wordmark />
          <span className="flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground"><Eye className="h-3.5 w-3.5" /> Lecture seule</span>
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-4 p-4 pb-16">
        <Card className="bg-gradient-to-br from-primary to-primary/70 p-5 text-primary-foreground">
          <p className="text-sm font-semibold opacity-90">{countdownLabel(t.start_date, t.end_date)}</p>
          <h1 className="text-3xl font-extrabold">{t.name}</h1>
          <p className="mt-1 flex items-center gap-1 text-sm opacity-90">{t.destination && <><MapPin className="h-4 w-4" />{t.destination} · </>}{fmtDateRange(t.start_date, t.end_date)}</p>
          <div className="mt-3 flex items-center gap-2">
            <AvatarStack people={data.members.map((m) => ({ id: m.id, name: m.display_name, color: m.color }))} max={8} />
            <span className="text-xs opacity-90">{data.members.map((m) => m.display_name).join(', ')}</span>
          </div>
        </Card>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="program"><CalendarDays /> Programme</TabsTrigger>
            <TabsTrigger value="map"><MapIcon /> Carte</TabsTrigger>
            <TabsTrigger value="bookings"><Ticket /> Transports & logements</TabsTrigger>
          </TabsList>

          <TabsContent value="program" className="space-y-4">
            {days.map((d, i) => {
              const acts = data.activities.filter((a) => a.day_date === d).sort((a, b) => (a.start_time ?? '99').localeCompare(b.start_time ?? '99') || a.sort_order - b.sort_order)
              return (
                <section key={d}>
                  <h2 className="mb-2 flex items-center gap-2 text-lg font-bold first-letter:uppercase">
                    <span className={`flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-bold ${d === today ? 'bg-coral text-coral-foreground' : 'bg-primary/10 text-primary'}`}>J{i + 1}</span>
                    {fmtDayLong(d)}
                  </h2>
                  {acts.length ? (
                    <ul className="space-y-2">
                      {acts.map((a) => (
                        <li key={a.id} className="flex gap-3 rounded-2xl border bg-card p-3">
                          <span className="text-xl">{ACTIVITY_CATEGORIES[a.category]?.emoji ?? '📍'}</span>
                          <div className="min-w-0">
                            <p className="font-semibold">{a.start_time && <span className="mr-1 text-primary">{fmtTime(a.start_time)}</span>}{a.title}</p>
                            {a.place_id && placeById[a.place_id] && <p className="text-xs text-muted-foreground"><MapPin className="mr-0.5 inline h-3 w-3" />{placeById[a.place_id].name}</p>}
                            {a.description && <p className="mt-1 text-sm text-muted-foreground">{a.description}</p>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="rounded-2xl border border-dashed p-3 text-center text-xs text-muted-foreground">Journée libre ✨</p>}
                </section>
              )
            })}
            {!days.length && <EmptyState icon={CalendarDays} title="Programme à venir" />}
          </TabsContent>

          <TabsContent value="map">
            <div className="h-[65dvh] overflow-hidden rounded-3xl border">
              <MapContainer
                bounds={mapped.length > 1 ? L.latLngBounds(mapped.map((p) => [p.lat, p.lng])) : undefined}
                center={mapped.length === 1 ? [mapped[0].lat, mapped[0].lng] : t.lat != null && t.lng != null ? [t.lat, t.lng] : [46.6, 2.4]}
                zoom={mapped.length === 1 ? 14 : 11} className="h-full w-full">
                <TileLayer url={tile.url} attribution={tile.attribution} maxZoom={tile.maxZoom} />
                {mapped.map((p) => (
                  <Marker key={p.id} position={[p.lat, p.lng]} icon={L.divIcon({ className: '', iconSize: [16, 16], iconAnchor: [8, 8], html: '<div style="width:16px;height:16px;border-radius:50%;background:#1f6f8b;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>' })}>
                    <Popup><div className="space-y-1 font-sans"><p className="text-sm font-bold">{p.name}</p>{p.address && <p className="text-xs opacity-70">{p.address}</p>}<MapLinks lat={p.lat} lng={p.lng} name={p.name} /></div></Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </TabsContent>

          <TabsContent value="bookings" className="space-y-2">
            {data.bookings.length ? [...data.bookings].sort((a, b) => (a.start_at ?? '9').localeCompare(b.start_at ?? '9')).map((b) => (
              <div key={b.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
                <span className="text-xl">{BOOKING_TYPES[b.type]?.emoji}</span>
                <div className="min-w-0">
                  <p className="font-semibold">{b.title}</p>
                  <p className="text-xs text-muted-foreground first-letter:uppercase">{b.start_at ? fmtDateTime(b.start_at) : 'Date à préciser'}{b.end_at ? ` → ${fmtDateTime(b.end_at)}` : ''}{b.place_id && placeById[b.place_id] ? ` · ${placeById[b.place_id].name}` : ''}</p>
                </div>
              </div>
            )) : <EmptyState icon={Ticket} title="Aucune réservation partagée" />}
          </TabsContent>
        </Tabs>
        <p className="text-center text-xs text-muted-foreground">Vue partagée par les voyageurs · mise à jour automatique · numéros de réservation et budget non affichés</p>
      </main>
    </div>
  )
}
