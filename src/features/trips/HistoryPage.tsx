import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { History } from 'lucide-react'
import { useTrip } from './TripContext'
import { useTripTable } from '@/lib/data'
import { fmtAgo, fmtDayLong } from '@/lib/format'
import { useNow } from '@/lib/hooks'
import { PageTitle } from '@/components/PageTitle'
import { Avatar } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import { ListSkeleton } from '@/components/ui/skeleton'
import type { ActivityLogEntry } from '@/lib/types'

const ENTITY: Record<string, { label: string; emoji: string; path?: string }> = {
  activities: { label: 'l’activité', emoji: '🗓️', path: 'activities' },
  bookings: { label: 'la réservation', emoji: '🎫', path: 'bookings' },
  expenses: { label: 'la dépense', emoji: '💶' },
  trip_members: { label: 'le participant', emoji: '👤' },
  settlements: { label: 'un remboursement', emoji: '🤝' },
  comments: { label: 'un commentaire', emoji: '💬' },
  places: { label: 'le lieu', emoji: '📍' },
  budgets: { label: 'le budget prévu', emoji: '🎯' },
  checklist_items: { label: 'l’élément de checklist', emoji: '🎒' },
  journal_entries: { label: 'une note du journal', emoji: '📔' },
}
const VERB = { insert: 'a ajouté', update: 'a modifié', delete: 'a supprimé' } as const

export default function HistoryPage() {
  const { trip, memberByUser, userId } = useTrip()
  const log = useTripTable(trip.id, 'activity_log')
  useNow(30_000)
  const groups = useMemo(() => {
    const sorted = [...(log.data ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))
    const out: { day: string; items: ActivityLogEntry[] }[] = []
    for (const e of sorted) {
      const day = e.created_at.slice(0, 10)
      const last = out.at(-1)
      if (last?.day === day) last.items.push(e)
      else out.push({ day, items: [e] })
    }
    return out
  }, [log.data])

  if (log.isLoading) return <ListSkeleton />
  return (
    <div className="space-y-4">
      <PageTitle title="Historique" subtitle="Qui a fait quoi dans le voyage" />
      {!groups.length ? (
        <EmptyState icon={History} title="Rien pour l’instant" description="Chaque ajout ou modification apparaîtra ici." />
      ) : (
        groups.map((g) => (
          <section key={g.day}>
            <h2 className="mb-2 text-sm font-bold text-muted-foreground first-letter:uppercase">{fmtDayLong(g.day)}</h2>
            <ol className="space-y-1">
              {g.items.map((e) => {
                const who = e.actor_id ? memberByUser[e.actor_id] : undefined
                const ent = ENTITY[e.entity_type] ?? { label: e.entity_type, emoji: '•' }
                const title = e.payload?.title
                const linkable = ent.path && e.action !== 'delete'
                return (
                  <li key={e.id} className="flex items-start gap-3 rounded-2xl px-2 py-2 hover:bg-muted/50">
                    <Avatar name={who?.display_name ?? '?'} color={who?.color ?? '#9ca3af'} size="sm" />
                    <p className="min-w-0 flex-1 text-sm">
                      <strong>{e.actor_id === userId ? 'Tu' : who?.display_name ?? 'Quelqu’un'}</strong>{' '}
                      {e.actor_id === userId ? VERB[e.action].replace('a ', 'as ') : VERB[e.action]} {ent.label}{' '}
                      {title && (linkable ? <Link to={`/t/${trip.id}/${ent.path}/${e.entity_id}`} className="font-semibold text-primary hover:underline">« {title} »</Link> : <span className="font-semibold">« {title} »</span>)}
                      <span className="block text-xs text-muted-foreground">{ent.emoji} {fmtAgo(e.created_at)}</span>
                    </p>
                  </li>
                )
              })}
            </ol>
          </section>
        ))
      )}
    </div>
  )
}
