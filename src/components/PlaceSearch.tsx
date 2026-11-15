import { useEffect, useRef, useState } from 'react'
import { Loader2, MapPin, Search, X } from 'lucide-react'
import { geocode, type GeoResult } from '@/lib/geocode'
import { Input } from './ui/input'
import { cn } from '@/lib/utils'

interface Props {
  value?: string
  onSelect: (r: GeoResult) => void
  onClear?: () => void
  placeholder?: string
  near?: { lat: number; lng: number } | null
  id?: string
  autoFocus?: boolean
  className?: string
}

/** Champ d'autocomplétion de lieu (Photon) : debounce 450 ms + 1 req/s max */
export function PlaceSearch({ value = '', onSelect, onClear, placeholder = 'Rechercher un lieu…', near, id, autoFocus, className }: Props) {
  const [q, setQ] = useState(value)
  const [results, setResults] = useState<GeoResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const touched = useRef(false)

  useEffect(() => setQ(value), [value])

  useEffect(() => {
    if (!touched.current || q.trim().length < 3) {
      setResults([])
      return
    }
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const r = await geocode(q, { near: near ?? undefined, signal: ctrl.signal })
        setResults(r)
        setActive(0)
        setOpen(true)
      } catch (e) {
        if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : 'Erreur')
      } finally {
        if (!ctrl.signal.aborted) setLoading(false)
      }
    }, 450)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [q, near])

  const pick = (r: GeoResult) => {
    touched.current = false
    setQ(r.name)
    setOpen(false)
    onSelect(r)
  }

  const listId = `${id ?? 'place'}-list`
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        autoFocus={autoFocus}
        className="pl-9 pr-9"
        placeholder={placeholder}
        value={q}
        onChange={(e) => {
          touched.current = true
          setQ(e.target.value)
        }}
        onFocus={() => results.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!open || !results.length) return
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)) }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
          if (e.key === 'Enter') { e.preventDefault(); pick(results[active]) }
          if (e.key === 'Escape') setOpen(false)
        }}
      />
      <span className="absolute right-2 top-1/2 -translate-y-1/2">
        {loading ? (
          <Loader2 className="m-1 h-4 w-4 animate-spin text-muted-foreground" />
        ) : q && onClear ? (
          <button type="button" className="rounded-full p-1 text-muted-foreground hover:bg-muted" aria-label="Effacer le lieu"
            onClick={() => { setQ(''); setResults([]); onClear() }}>
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </span>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      {open && results.length > 0 && (
        <ul id={listId} role="listbox" className="absolute z-[80] mt-1 max-h-72 w-full overflow-auto rounded-2xl border bg-popover p-1 shadow-lg">
          {results.map((r, i) => (
            <li
              key={r.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); pick(r) }}
              onMouseEnter={() => setActive(i)}
              className={cn('flex cursor-pointer items-start gap-2 rounded-xl px-3 py-2 text-sm', i === active && 'bg-accent')}
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-coral" />
              <span className="min-w-0">
                <span className="block truncate font-semibold">{r.name}</span>
                {r.label && <span className="block truncate text-xs text-muted-foreground">{r.label}</span>}
              </span>
            </li>
          ))}
          <li className="px-3 py-1 text-[10px] text-muted-foreground">Données © OpenStreetMap</li>
        </ul>
      )}
    </div>
  )
}
