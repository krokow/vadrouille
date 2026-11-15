import { Link } from 'react-router-dom'
import { CalendarClock, CalendarDays, Check, Ticket } from 'lucide-react'
import { toast } from 'sonner'
import { useTrip } from '@/features/trips/TripContext'
import { useQuickAdd } from '@/features/trips/QuickAdd'
import { deadlineLabel } from '@/lib/dates'
import { fmtDay } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { TodoItem } from './logic'

const URGENCY_STYLE = {
  overdue: 'border-l-destructive bg-destructive/5',
  soon: 'border-l-warning bg-warning/5',
  later: 'border-l-primary/40',
  none: 'border-l-border',
} as const

export function TodoList({ items, compact }: { items: TodoItem[]; compact?: boolean }) {
  const { trip, canEdit, writer } = useTrip()
  const quick = useQuickAdd()
  const done = async (it: TodoItem) => {
    if (it.kind === 'task') {
      await writer.update('checklist_items', it.id, { done: true })
      toast.success(`« ${it.title} » fait ✅`)
    } else if (it.kind === 'activity') {
      await writer.update('activities', it.id, { booking_status: 'booked' })
      toast.success(`« ${it.title} » réservé ✅`, {
        action: { label: 'Ajouter la réservation', onClick: () => quick({ kind: 'booking', defaults: { fromActivity: it.id } }) },
      })
    } else {
      await writer.update('bookings', it.id, { status: 'booked' })
      toast.success(`« ${it.title} » réservé ✅`)
    }
  }
  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <li key={`${it.kind}-${it.id}`} className={cn('flex items-center gap-3 rounded-2xl border border-l-4 bg-card p-3', URGENCY_STYLE[it.urgency])}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted" aria-hidden>
            {it.kind === 'activity' ? <CalendarDays className="h-4 w-4" /> : it.kind === 'task' ? <CalendarClock className="h-4 w-4" /> : <Ticket className="h-4 w-4" />}
          </span>
          <Link to={it.kind === 'task' ? `/t/${trip.id}/checklist` : `/t/${trip.id}/${it.kind === 'activity' ? 'activities' : 'bookings'}/${it.id}`} className="min-w-0 flex-1">
            <p className="truncate font-semibold">{it.title}</p>
            <p className={cn('text-xs', it.urgency === 'overdue' ? 'font-bold text-destructive' : it.urgency === 'soon' ? 'font-semibold text-warning-foreground dark:text-warning' : 'text-muted-foreground')}>
              {it.kind === 'task' && <span className="font-semibold">Préparatif · </span>}
              {it.deadline ? `${deadlineLabel(it.deadline)} · avant le ${fmtDay(it.deadline)}` : 'Sans date limite'}
              {!compact && it.when && it.when !== it.deadline ? ` · le ${fmtDay(it.when)}` : ''}
            </p>
          </Link>
          {canEdit && (
            <Button variant="outline" size={compact ? 'icon-sm' : 'sm'} onClick={() => done(it)} aria-label={`Marquer « ${it.title} » comme ${it.kind === 'task' ? 'fait' : 'réservé'}`}>
              <Check />{!compact && <span className="hidden sm:inline">{it.kind === 'task' ? 'Fait' : 'Réservé'}</span>}
            </Button>
          )}
        </li>
      ))}
    </ul>
  )
}
