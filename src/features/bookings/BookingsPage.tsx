import { useMemo, useState } from 'react'
import { Plus, Ticket } from 'lucide-react'
import { useTrip } from '@/features/trips/TripContext'
import { useQuickAdd } from '@/features/trips/QuickAdd'
import { useTripTable } from '@/lib/data'
import { BOOKING_TYPES } from '@/lib/constants'
import { fmtDayLong } from '@/lib/format'
import { indexBy } from '@/lib/utils'
import type { BookingType } from '@/lib/types'
import { PageTitle } from '@/components/PageTitle'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ListSkeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { BookingCard } from './BookingCard'

type Filter = 'all' | 'to_book' | BookingType

export default function BookingsPage() {
  const { trip, canEdit } = useTrip()
  const quick = useQuickAdd()
  const bookings = useTripTable(trip.id, 'bookings')
  const places = useTripTable(trip.id, 'places')
  const attachments = useTripTable(trip.id, 'attachments')
  const [filter, setFilter] = useState<Filter>('all')
  const placeById = indexBy(places.data)
  const filesOf = useMemo(() => {
    const out: Record<string, number> = {}
    for (const a of attachments.data ?? []) if (a.parent_type === 'booking') out[a.parent_id] = (out[a.parent_id] ?? 0) + 1
    return out
  }, [attachments.data])

  const groups = useMemo(() => {
    const list = (bookings.data ?? [])
      .filter((b) => filter === 'all' || (filter === 'to_book' ? b.status === 'to_book' : b.type === filter))
      .sort((a, b) => (a.start_at ?? '9999').localeCompare(b.start_at ?? '9999'))
    const out: { day: string | null; items: typeof list }[] = []
    for (const b of list) {
      const day = b.start_at ? b.start_at.slice(0, 10) : null
      const last = out.at(-1)
      if (last && last.day === day) last.items.push(b)
      else out.push({ day, items: [b] })
    }
    return out
  }, [bookings.data, filter])

  const types = useMemo(() => [...new Set((bookings.data ?? []).map((b) => b.type))], [bookings.data])
  const toBook = (bookings.data ?? []).filter((b) => b.status === 'to_book').length

  if (bookings.isLoading) return <ListSkeleton />
  return (
    <div className="space-y-4">
      <PageTitle
        title="Réservations"
        subtitle={bookings.data?.length ? `${bookings.data.length} réservation${bookings.data.length > 1 ? 's' : ''}${toBook ? ` · ${toBook} à réserver` : ''}` : undefined}
        action={canEdit && <Button onClick={() => quick({ kind: 'booking' })} className="hidden sm:inline-flex"><Plus /> Réservation</Button>}
      />
      {!!bookings.data?.length && (
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4">
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>Tout</FilterChip>
          {toBook > 0 && <FilterChip active={filter === 'to_book'} onClick={() => setFilter('to_book')}>⏳ À réserver</FilterChip>}
          {types.map((t) => <FilterChip key={t} active={filter === t} onClick={() => setFilter(t)}>{BOOKING_TYPES[t].emoji} {BOOKING_TYPES[t].label}</FilterChip>)}
        </div>
      )}
      {!bookings.data?.length ? (
        <EmptyState icon={Ticket} title="Aucune réservation" description="Vols, trains, logements, restos, billets : centralise tout ici avec les numéros de confirmation et les PDF."
          action={canEdit && <Button onClick={() => quick({ kind: 'booking' })}><Plus /> Ajouter une réservation</Button>} />
      ) : (
        <ol className="space-y-5">
          {groups.map((g) => (
            <li key={g.day ?? 'none'}>
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground first-letter:uppercase">{g.day ? fmtDayLong(g.day) : 'Sans date'}</h2>
              <div className="grid gap-2 lg:grid-cols-2">
                {g.items.map((b) => <BookingCard key={b.id} booking={b} place={b.place_id ? placeById[b.place_id] : undefined} files={filesOf[b.id]} />)}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={active}
      className={cn('shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold', active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card')}>
      {children}
    </button>
  )
}
