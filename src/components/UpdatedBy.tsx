import { useTrip } from '@/features/trips/TripContext'
import { fmtAgo } from '@/lib/format'
import { useNow } from '@/lib/hooks'
import { cn } from '@/lib/utils'

/** « modifié par Bob il y a 2 min » */
export function UpdatedBy({ row, className }: { row: { updated_at: string; updated_by?: string | null; created_at?: string }; className?: string }) {
  const { memberByUser, userId } = useTrip()
  useNow(30_000)
  if (!row.updated_at) return null
  const who = row.updated_by ? (row.updated_by === userId ? 'toi' : memberByUser[row.updated_by]?.display_name ?? 'quelqu’un') : null
  const verb = row.created_at && Math.abs(new Date(row.updated_at).getTime() - new Date(row.created_at).getTime()) < 2000 ? 'ajouté' : 'modifié'
  return (
    <span className={cn('text-[11px] text-muted-foreground', className)}>
      {verb}{who ? ` par ${who}` : ''} {fmtAgo(row.updated_at)}
    </span>
  )
}
