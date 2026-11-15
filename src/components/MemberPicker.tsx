import type { TripMember } from '@/lib/types'
import { Avatar } from './ui/avatar'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

/** Sélection multiple de participants sous forme de pastilles */
export function MemberPicker({
  members, value, onChange, label = 'Participants',
}: { members: TripMember[]; value: string[]; onChange: (ids: string[]) => void; label?: string }) {
  const all = members.length > 0 && value.length === members.length
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onChange(all ? [] : members.map((m) => m.id))}
        className={cn('rounded-full border px-3 py-1.5 text-xs font-semibold', all ? 'border-primary bg-primary text-primary-foreground' : 'bg-card')}
        aria-pressed={all}
      >
        Tout le monde
      </button>
      {members.map((m) => {
        const on = value.includes(m.id)
        return (
          <button
            type="button"
            key={m.id}
            onClick={() => toggle(m.id)}
            aria-pressed={on}
            className={cn(
              'flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-xs font-semibold transition-colors',
              on ? 'border-transparent text-white' : 'bg-card text-foreground opacity-70',
            )}
            style={on ? { backgroundColor: m.color } : undefined}
          >
            <span className="relative">
              <Avatar name={m.display_name} color={m.color} size="xs" ghost={m.is_ghost} className="ring-0" />
              {on && <Check className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-white p-0.5 text-black" strokeWidth={4} />}
            </span>
            {m.display_name}
          </button>
        )
      })}
    </div>
  )
}
