import { useMemo } from 'react'
import { PartyPopper, Plus } from 'lucide-react'
import { useTrip } from '@/features/trips/TripContext'
import { useQuickAdd } from '@/features/trips/QuickAdd'
import { useTripTable } from '@/lib/data'
import { PageTitle } from '@/components/PageTitle'
import { EmptyState } from '@/components/ui/empty-state'
import { ListSkeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { buildTodo } from './logic'
import { TodoList } from './TodoList'

export default function TodoPage() {
  const { trip, canEdit } = useTrip()
  const quick = useQuickAdd()
  const activities = useTripTable(trip.id, 'activities')
  const bookings = useTripTable(trip.id, 'bookings')
  const items = useMemo(() => buildTodo(activities.data ?? [], bookings.data ?? []), [activities.data, bookings.data])
  const overdue = items.filter((i) => i.urgency === 'overdue').length
  const soon = items.filter((i) => i.urgency === 'soon').length

  if (activities.isLoading || bookings.isLoading) return <ListSkeleton />
  return (
    <div className="space-y-4">
      <PageTitle
        title="À réserver"
        subtitle={items.length ? `${items.length} élément${items.length > 1 ? 's' : ''}${overdue ? ` · ${overdue} en retard` : ''}${soon ? ` · ${soon} cette semaine` : ''}` : undefined}
        action={canEdit && <Button variant="outline" onClick={() => quick({ kind: 'activity', defaults: { needs_booking: true } })}><Plus /> À réserver</Button>}
      />
      {items.length ? (
        <TodoList items={items} />
      ) : (
        <EmptyState icon={PartyPopper} title="Tout est réservé !" description="Coche « À réserver » sur une activité ou crée une réservation au statut « à réserver » pour la suivre ici." />
      )}
    </div>
  )
}
