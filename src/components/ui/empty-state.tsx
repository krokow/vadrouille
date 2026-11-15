import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function EmptyState({
  icon: Icon, title, description, action, className,
}: { icon: LucideIcon; title: string; description?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center rounded-3xl border border-dashed bg-card/50 px-6 py-10 text-center', className)}>
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-xs text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
