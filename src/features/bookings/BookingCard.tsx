import { Link } from 'react-router-dom'
import { Clock, MapPin, Paperclip } from 'lucide-react'
import type { Booking, Place } from '@/lib/types'
import { BOOKING_STATUS, BOOKING_TYPES } from '@/lib/constants'
import { fmtDateTime, fmtMoney } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { DeadlineBadge } from '@/components/DeadlineBadge'
import { cn } from '@/lib/utils'

export function BookingCard({ booking: b, place, files = 0 }: { booking: Booking; place?: Place; files?: number }) {
  const t = BOOKING_TYPES[b.type]
  const s = BOOKING_STATUS[b.status]
  const sameDay = b.start_at && b.end_at && b.start_at.slice(0, 10) === b.end_at.slice(0, 10)
  return (
    <Link to={b.id} className={cn('flex gap-3 rounded-2xl border bg-card p-3 shadow-sm transition-colors hover:bg-accent/40', b.status === 'cancelled' && 'opacity-60')}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl" style={{ backgroundColor: `${t.color}22` }} aria-hidden>{t.emoji}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className={cn('font-semibold leading-snug', b.status === 'cancelled' && 'line-through')}>{b.title}</h3>
          {b.status === 'to_book' ? <DeadlineBadge deadline={b.booking_deadline ?? b.start_at?.slice(0, 10) ?? null} compact /> : <Badge variant={s.variant}>{s.label}</Badge>}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {b.start_at && (
            <span className="flex items-center gap-1 first-letter:uppercase"><Clock className="h-3 w-3" />{fmtDateTime(b.start_at)}{b.end_at && (sameDay ? ` → ${new Date(b.end_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ` → ${fmtDateTime(b.end_at)}`)}</span>
          )}
          {place && <span className="flex min-w-0 items-center gap-1"><MapPin className="h-3 w-3" /><span className="truncate">{place.name}</span></span>}
          {b.price != null && <span className="font-semibold text-foreground">{fmtMoney(b.price, b.currency ?? 'EUR')}</span>}
          {files > 0 && <span className="flex items-center gap-1"><Paperclip className="h-3 w-3" />{files}</span>}
        </div>
        {b.confirmation_code && <p className="mt-1.5 inline-block rounded-lg bg-muted px-2 py-0.5 font-mono text-xs font-bold tracking-wider">{b.confirmation_code}</p>}
      </div>
    </Link>
  )
}
