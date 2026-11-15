import { cn } from '@/lib/utils'

/** Jauge prévu vs dépensé : passe en orange à 85 %, en rouge au-delà de 100 % */
export function Gauge({ value, max, className, label }: { value: number; max: number; className?: string; label?: string }) {
  const pct = max > 0 ? (value / max) * 100 : value > 0 ? 100 : 0
  const color = pct > 100 ? 'bg-destructive' : pct >= 85 ? 'bg-warning' : 'bg-primary'
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(Math.min(pct, 100))}
      className={cn('h-2.5 w-full overflow-hidden rounded-full bg-muted', className)}
    >
      <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  )
}
