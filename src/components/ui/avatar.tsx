import { cn } from '@/lib/utils'
import { initials } from '@/lib/ids'

interface AvatarProps {
  name: string
  color: string
  src?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg'
  ghost?: boolean
  className?: string
  title?: string
}

const sizes = { xs: 'h-6 w-6 text-[10px]', sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-16 w-16 text-xl' }

export function Avatar({ name, color, src, size = 'sm', ghost, className, title }: AvatarProps) {
  return (
    <span
      title={title ?? name}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-bold text-white ring-2 ring-background',
        sizes[size],
        ghost && 'border-2 border-dashed border-white/70',
        className,
      )}
      style={{ backgroundColor: color }}
    >
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : initials(name)}
    </span>
  )
}

export function AvatarStack({ people, max = 4, size = 'sm' }: { people: { id: string; name: string; color: string; src?: string | null }[]; max?: number; size?: AvatarProps['size'] }) {
  const shown = people.slice(0, max)
  const rest = people.length - shown.length
  return (
    <div className="flex -space-x-2">
      {shown.map((p) => (
        <Avatar key={p.id} name={p.name} color={p.color} src={p.src} size={size} />
      ))}
      {rest > 0 && (
        <span className={cn('inline-flex items-center justify-center rounded-full bg-muted font-bold text-muted-foreground ring-2 ring-background', sizes[size])}>
          +{rest}
        </span>
      )}
    </div>
  )
}
