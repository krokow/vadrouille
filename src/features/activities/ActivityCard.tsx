import { Link } from 'react-router-dom'
import { Clock, GripVertical, MapPin, MessageCircle, ThumbsUp } from 'lucide-react'
import type { Activity, Place, TripMember } from '@/lib/types'
import { ACTIVITY_CATEGORIES } from '@/lib/constants'
import { fmtMoney, fmtTime } from '@/lib/format'
import { DeadlineBadge } from '@/components/DeadlineBadge'
import { AvatarStack } from '@/components/ui/avatar'
import { UpdatedBy } from '@/components/UpdatedBy'
import { cn } from '@/lib/utils'

export interface ActivityCardProps {
  activity: Activity
  place?: Place
  attendees?: TripMember[]
  totalMembers?: number
  votes?: number
  voted?: boolean
  comments?: number
  onVote?: () => void
  dragHandle?: React.ReactNode
  menu?: React.ReactNode
  compact?: boolean
  showUpdated?: boolean
  className?: string
}

export function ActivityCard({ activity: a, place, attendees = [], totalMembers = 0, votes = 0, voted, comments = 0, onVote, dragHandle, menu, compact, showUpdated, className }: ActivityCardProps) {
  const cat = ACTIVITY_CATEGORIES[a.category] ?? ACTIVITY_CATEGORIES.other
  const time = a.start_time ? `${fmtTime(a.start_time)}${a.end_time ? ` – ${fmtTime(a.end_time)}` : ''}` : a.duration_min ? `${Math.round(a.duration_min / 6) / 10} h` : null
  return (
    <div className={cn('group relative flex items-stretch gap-2 rounded-2xl border bg-card p-3 shadow-sm', className)}>
      {dragHandle}
      <span className="mt-0.5 text-xl leading-none" aria-hidden>{cat.emoji}</span>
      <div className="min-w-0 flex-1">
        <Link to={`../activities/${a.id}`} relative="path" className="after:absolute after:inset-0 focus-visible:outline-none">
          <h3 className="font-semibold leading-snug">{a.title}</h3>
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {time && <span className="flex items-center gap-1 font-semibold text-foreground"><Clock className="h-3 w-3" />{time}</span>}
          {place && <span className="flex min-w-0 items-center gap-1"><MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{place.name}</span></span>}
          {a.est_cost != null && <span>{fmtMoney(a.est_cost, a.currency ?? 'EUR', { compact: true })}</span>}
          {comments > 0 && <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" />{comments}</span>}
        </div>
        {(a.needs_booking || (!compact && Object.values(a.attention_notes ?? {}).some(Boolean))) && (
          <div className="mt-2 flex flex-wrap gap-1">
            {a.needs_booking && <DeadlineBadge deadline={a.booking_deadline ?? a.day_date} booked={a.booking_status === 'booked'} />}
            {a.attention_notes?.closed_days && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">🚫 {a.attention_notes.closed_days}</span>}
            {a.attention_notes?.opening_hours && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">🕘 {a.attention_notes.opening_hours}</span>}
          </div>
        )}
        {showUpdated && <UpdatedBy row={a} className="mt-1 block" />}
      </div>
      <div className="relative z-10 flex flex-col items-end justify-between gap-2">
        {menu}
        {onVote ? (
          <button
            onClick={onVote}
            aria-pressed={voted}
            aria-label={`${voted ? 'Retirer mon vote' : 'Voter'} (${votes})`}
            className={cn('flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-bold transition-colors', voted ? 'border-coral bg-coral text-coral-foreground' : 'bg-card hover:bg-accent')}
          >
            <ThumbsUp className="h-3.5 w-3.5" /> {votes}
          </button>
        ) : votes > 0 ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground"><ThumbsUp className="h-3 w-3" />{votes}</span>
        ) : <span />}
        {!compact && attendees.length > 0 && attendees.length < totalMembers && (
          <AvatarStack people={attendees.map((m) => ({ id: m.id, name: m.display_name, color: m.color }))} size="xs" max={3} />
        )}
      </div>
    </div>
  )
}

export function DragHandle(props: React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" aria-label="Déplacer (glisser)" className="relative z-10 -my-1 -ml-1 flex touch-none items-center rounded-lg px-0.5 text-muted-foreground/60 hover:bg-muted hover:text-foreground" {...props}>
      <GripVertical className="h-4 w-4" />
    </button>
  )
}
