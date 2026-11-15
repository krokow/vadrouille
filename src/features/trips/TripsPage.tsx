import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, MapPin, Compass, Luggage, Sparkles, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/features/auth/AuthProvider'
import { qk } from '@/lib/data'
import { createSampleTrip } from './sample'
import { useAllMembers, useTrips } from '@/lib/data'
import { tripPhase, countdownLabel, type TripPhase } from '@/lib/dates'
import { fmtDateRange } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { AvatarStack } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import type { Trip, TripMember } from '@/lib/types'
import { TripCover } from './TripCover'
import { TripFormDialog } from './TripForm'
import { AppHeader } from '@/app/AppHeader'
import { cn } from '@/lib/utils'

export function TripsPage() {
  const { t } = useTranslation()
  const trips = useTrips()
  const members = useAllMembers()
  const [creating, setCreating] = useState(false)
  const [sampling, setSampling] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const sample = async () => {
    if (!user) return
    setSampling(true)
    try {
      const id = await createSampleTrip(user.id)
      await qc.invalidateQueries({ queryKey: qk.trips })
      await qc.invalidateQueries({ queryKey: qk.allMembers })
      navigate(`/t/${id}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Impossible de créer l’exemple')
    } finally {
      setSampling(false)
    }
  }

  const groups = useMemo(() => {
    const g: Record<'upcoming' | 'ongoing' | 'past', Trip[]> = { upcoming: [], ongoing: [], past: [] }
    for (const trip of trips.data ?? []) {
      const p = tripPhase(trip.start_date, trip.end_date)
      g[p === 'undated' ? 'upcoming' : p].push(trip)
    }
    g.upcoming.sort((a, b) => (a.start_date ?? '9999').localeCompare(b.start_date ?? '9999'))
    g.past.sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? ''))
    return g
  }, [trips.data])

  const membersByTrip = useMemo(() => {
    const out: Record<string, TripMember[]> = {}
    for (const m of members.data ?? []) (out[m.trip_id] ??= []).push(m)
    return out
  }, [members.data])

  const defaultTab = groups.ongoing.length ? 'ongoing' : groups.upcoming.length || !groups.past.length ? 'upcoming' : 'past'

  return (
    <div className="min-h-dvh paper">
      <AppHeader />
      <main className="container max-w-5xl pb-24 pt-2">
        <div className="mb-5 flex items-end justify-between gap-3">
          <h1 className="text-3xl font-bold">{t('Mes voyages')}</h1>
          <Button onClick={() => setCreating(true)} variant="coral" className="hidden sm:inline-flex"><Plus /> {t('Nouveau voyage')}</Button>
        </div>
        {trips.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-56" />)}
          </div>
        ) : !trips.data?.length ? (
          <EmptyState
            icon={Luggage}
            title="Aucun voyage pour l'instant"
            description="Crée ton premier voyage puis invite tes compagnons avec un simple lien."
            action={
              <div className="flex flex-col items-center gap-2 sm:flex-row">
                <Button variant="coral" onClick={() => setCreating(true)}><Plus /> Créer un voyage</Button>
                <Button variant="outline" onClick={sample} disabled={sampling}>{sampling ? <Loader2 className="animate-spin" /> : <Sparkles />} Voir un voyage d’exemple</Button>
              </div>
            }
          />
        ) : (
          <Tabs defaultValue={defaultTab}>
            <TabsList className="w-full sm:w-auto">
              {(['ongoing', 'upcoming', 'past'] as const).map((k) => (
                <TabsTrigger key={k} value={k} disabled={k === 'ongoing' && !groups.ongoing.length}>
                  {t({ ongoing: 'En cours', upcoming: 'À venir', past: 'Passés' }[k])}
                  <span className="rounded-full bg-muted px-1.5 text-[10px]">{groups[k].length}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            {(['ongoing', 'upcoming', 'past'] as const).map((k) => (
              <TabsContent key={k} value={k}>
                {groups[k].length ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {groups[k].map((trip) => <TripCard key={trip.id} trip={trip} members={membersByTrip[trip.id] ?? []} />)}
                  </div>
                ) : (
                  <EmptyState icon={Compass} title="Rien ici" description={k === 'past' ? 'Tes voyages terminés apparaîtront ici (et pourront servir de modèle).' : 'Pas de voyage dans cette catégorie.'} />
                )}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </main>
      <button
        onClick={() => setCreating(true)}
        aria-label={t('Nouveau voyage')}
        className="fixed bottom-6 right-4 flex h-14 w-14 items-center justify-center rounded-full bg-coral text-coral-foreground shadow-xl sm:hidden"
      >
        <Plus className="h-7 w-7" />
      </button>
      {creating && <TripFormDialog open={creating} onOpenChange={setCreating} />}
    </div>
  )
}

function TripCard({ trip, members }: { trip: Trip; members: TripMember[] }) {
  const phase: TripPhase = tripPhase(trip.start_date, trip.end_date)
  const label = countdownLabel(trip.start_date, trip.end_date)
  return (
    <Link
      to={`/t/${trip.id}`}
      className="group overflow-hidden rounded-3xl border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2"
    >
      <TripCover trip={trip} className="h-36">
        <div className="flex h-full flex-col justify-between p-3 text-white">
          <span className={cn('self-end rounded-full px-2.5 py-1 text-xs font-bold backdrop-blur',
            phase === 'ongoing' ? 'bg-coral text-white' : 'bg-black/35')}>
            {label}
          </span>
          <h2 className="font-display text-xl font-semibold leading-tight drop-shadow">{trip.name}</h2>
        </div>
      </TripCover>
      <div className="flex items-center justify-between gap-2 p-3">
        <div className="min-w-0 text-sm">
          <p className="font-semibold">{fmtDateRange(trip.start_date, trip.end_date)}</p>
          {trip.destination && (
            <p className="flex items-center gap-1 truncate text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{trip.destination}</p>
          )}
        </div>
        <AvatarStack people={members.map((m) => ({ id: m.id, name: m.display_name, color: m.color }))} size="xs" />
      </div>
    </Link>
  )
}
