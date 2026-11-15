import { AlarmClock, CheckCircle2 } from 'lucide-react'
import { Badge } from './ui/badge'
import { deadlineLabel, deadlineUrgency } from '@/lib/dates'
import { fmtDay } from '@/lib/format'

/** Pastille « À réserver » colorée selon l'urgence de la date limite */
export function DeadlineBadge({ deadline, booked, compact }: { deadline: string | null; booked?: boolean; compact?: boolean }) {
  if (booked) return <Badge variant="success"><CheckCircle2 /> Réservé</Badge>
  const u = deadlineUrgency(deadline)
  const variant = u === 'overdue' ? 'destructive' : u === 'soon' ? 'warning' : 'secondary'
  return (
    <Badge variant={variant} title={deadline ? `À réserver avant le ${fmtDay(deadline)}` : 'À réserver'} className={u === 'overdue' ? 'animate-pulse' : undefined}>
      <AlarmClock /> {compact || !deadline ? 'À réserver' : `À réserver · ${deadlineLabel(deadline)}`}
    </Badge>
  )
}
