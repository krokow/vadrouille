import { useMemo, useRef, useState } from 'react'
import { Send, Trash2 } from 'lucide-react'
import { useTrip } from '@/features/trips/TripContext'
import { useTripTable } from '@/lib/data'
import { fmtAgo } from '@/lib/format'
import { useNow } from '@/lib/hooks'
import type { ParentType } from '@/lib/types'
import { Avatar } from './ui/avatar'
import { Button } from './ui/button'
import { Textarea } from './ui/input'

/** Met en valeur les @mentions qui correspondent à un participant */
function renderBody(body: string, names: string[]) {
  if (!names.length) return body
  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).sort((a, b) => b.length - a.length)
  const re = new RegExp(`(@(?:${escaped.join('|')}))`, 'g')
  return body.split(re).map((part, i) =>
    part.startsWith('@') && names.includes(part.slice(1)) ? (
      <span key={i} className="rounded bg-primary/10 px-1 font-semibold text-primary">{part}</span>
    ) : (
      <span key={i}>{part}</span>
    ),
  )
}

export function Comments({ parentType, parentId }: { parentType: ParentType; parentId: string }) {
  const { trip, members, memberByUser, userId, writer, me, canEdit } = useTrip()
  const comments = useTripTable(trip.id, 'comments')
  const [body, setBody] = useState('')
  const [mention, setMention] = useState<string | null>(null)
  const ref = useRef<HTMLTextAreaElement>(null)
  useNow(60_000)
  const list = useMemo(
    () => (comments.data ?? []).filter((c) => c.parent_type === parentType && c.parent_id === parentId).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [comments.data, parentType, parentId],
  )
  const names = members.map((m) => m.display_name)
  const suggestions = mention !== null ? members.filter((m) => m.id !== me?.id && m.display_name.toLowerCase().startsWith(mention.toLowerCase())).slice(0, 5) : []

  const onChange = (v: string) => {
    setBody(v)
    const caret = ref.current?.selectionStart ?? v.length
    const m = /@([^\s@]*)$/.exec(v.slice(0, caret))
    setMention(m ? m[1] : null)
  }
  const insertMention = (name: string) => {
    const caret = ref.current?.selectionStart ?? body.length
    const before = body.slice(0, caret).replace(/@([^\s@]*)$/, `@${name} `)
    setBody(before + body.slice(caret))
    setMention(null)
    ref.current?.focus()
  }
  const send = async () => {
    const text = body.trim()
    if (!text) return
    setBody('')
    await writer.insert('comments', { trip_id: trip.id, parent_type: parentType, parent_id: parentId, author_id: userId, body: text })
  }

  return (
    <div className="space-y-3">
      {list.length === 0 && <p className="text-sm text-muted-foreground">Pas encore de commentaire. Une question, un avis ?</p>}
      <ul className="space-y-3">
        {list.map((c) => {
          const author = c.author_id ? memberByUser[c.author_id] : undefined
          const mine = c.author_id === userId
          return (
            <li key={c.id} className="flex gap-2">
              <Avatar name={author?.display_name ?? '?'} color={author?.color ?? '#999'} size="sm" />
              <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm bg-muted px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-bold">{author?.display_name ?? 'Ancien participant'}</span>
                  <span className="text-[10px] text-muted-foreground">{fmtAgo(c.created_at)}</span>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm">{renderBody(c.body, names)}</p>
              </div>
              {(mine || canEdit) && (
                <Button variant="ghost" size="icon-sm" aria-label="Supprimer le commentaire" onClick={() => writer.remove('comments', c.id)}><Trash2 /></Button>
              )}
            </li>
          )
        })}
      </ul>
      {me && (
        <div className="relative">
          {suggestions.length > 0 && (
            <ul className="absolute bottom-full mb-1 w-56 rounded-2xl border bg-popover p-1 shadow-lg" role="listbox" aria-label="Mentionner">
              {suggestions.map((m) => (
                <li key={m.id}>
                  <button type="button" className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-sm hover:bg-accent" onMouseDown={(e) => { e.preventDefault(); insertMention(m.display_name) }}>
                    <Avatar name={m.display_name} color={m.color} size="xs" /> {m.display_name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); void send() }}>
            <Textarea ref={ref} rows={1} value={body} onChange={(e) => onChange(e.target.value)} placeholder="Écrire un commentaire… (@ pour mentionner)" aria-label="Nouveau commentaire" className="min-h-[44px] resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && suggestions.length === 0) { e.preventDefault(); void send() }
                if ((e.key === 'Enter' || e.key === 'Tab') && suggestions.length) { e.preventDefault(); insertMention(suggestions[0].display_name) }
              }} />
            <Button type="submit" size="icon" disabled={!body.trim()} aria-label="Envoyer"><Send /></Button>
          </form>
        </div>
      )}
    </div>
  )
}
