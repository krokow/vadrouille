import { useMemo, useState } from 'react'
import { BookOpen, Camera, Loader2, Send, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useTrip } from './TripContext'
import { useTripTable } from '@/lib/data'
import { compressImage, uploadTripFile, useFileUrl } from '@/lib/files'
import { backend } from '@/lib/backend'
import { fmtAgo, fmtDayLong, isoDay } from '@/lib/format'
import { tripDays } from '@/lib/dates'
import { PageTitle } from '@/components/PageTitle'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { NativeSelect, Textarea } from '@/components/ui/input'
import { Avatar } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import { useConfirm } from '@/components/ui/confirm'
import type { JournalEntry } from '@/lib/types'

/** Carnet de bord partagé : souvenirs et photos, jour par jour */
export default function JournalPage() {
  const { trip, canEdit, writer, userId } = useTrip()
  const entries = useTripTable(trip.id, 'journal_entries')
  const days = tripDays(trip.start_date, trip.end_date)
  const today = isoDay()
  const [body, setBody] = useState('')
  const [day, setDay] = useState(days.includes(today) ? today : days[0] ?? today)
  const [photo, setPhoto] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)

  const groups = useMemo(() => {
    const g: Record<string, JournalEntry[]> = {}
    for (const e of [...(entries.data ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at))) (g[e.day_date ?? ''] ??= []).push(e)
    return Object.entries(g).sort(([a], [b]) => b.localeCompare(a))
  }, [entries.data])

  const post = async () => {
    if (!body.trim() && !photo) return
    setBusy(true)
    try {
      const photo_path = photo ? await uploadTripFile(trip.id, await compressImage(photo, 1800), 'journal') : null
      await writer.insert('journal_entries', { trip_id: trip.id, day_date: day || null, body: body.trim(), author_id: userId, photo_path })
      setBody('')
      setPhoto(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Envoi impossible')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageTitle title="Journal" subtitle="Les souvenirs du voyage, à plusieurs mains" />
      {canEdit && (
        <Card className="space-y-2 p-3">
          <Textarea rows={3} placeholder="Raconte ta journée, un moment drôle, une bonne adresse…" value={body} onChange={(e) => setBody(e.target.value)} aria-label="Nouvelle note" />
          <div className="flex flex-wrap items-center gap-2">
            <NativeSelect className="w-auto" value={day} onChange={(e) => setDay(e.target.value)} aria-label="Jour">
              {(days.length ? days : [today]).map((d) => <option key={d} value={d}>{fmtDayLong(d)}</option>)}
            </NativeSelect>
            <Button variant="outline" size="sm" asChild>
              <label className="cursor-pointer"><Camera /> {photo ? photo.name.slice(0, 16) : 'Photo'}<input type="file" accept="image/*" className="sr-only" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} /></label>
            </Button>
            <Button className="ml-auto" onClick={post} disabled={busy || (!body.trim() && !photo)}>{busy ? <Loader2 className="animate-spin" /> : <Send />} Publier</Button>
          </div>
        </Card>
      )}
      {!groups.length ? (
        <EmptyState icon={BookOpen} title="Le journal est vierge" description="Note chaque jour un souvenir ou une photo : vous aurez un bel album à la fin du voyage." />
      ) : (
        groups.map(([d, list]) => (
          <section key={d}>
            <h2 className="mb-2 font-display text-lg font-semibold first-letter:uppercase">{d ? fmtDayLong(d) : 'Sans date'}</h2>
            <div className="space-y-3">{list.map((e) => <Entry key={e.id} entry={e} />)}</div>
          </section>
        ))
      )}
    </div>
  )
}

function Entry({ entry: e }: { entry: JournalEntry }) {
  const { memberByUser, userId, canEdit, writer } = useTrip()
  const confirm = useConfirm()
  const photo = useFileUrl(e.photo_path)
  const author = e.author_id ? memberByUser[e.author_id] : undefined
  return (
    <Card className="overflow-hidden">
      {photo.data && <img src={photo.data} alt="" className="max-h-[70vh] w-full object-cover" loading="lazy" />}
      <div className="space-y-2 p-3">
        {e.body && <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{e.body}</p>}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Avatar name={author?.display_name ?? '?'} color={author?.color ?? '#999'} size="xs" />
          <span>{author?.display_name ?? '—'} · {fmtAgo(e.created_at)}</span>
          {(e.author_id === userId || canEdit) && (
            <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label="Supprimer la note" onClick={async () => {
              if (!(await confirm({ title: 'Supprimer cette note ?', destructive: true, confirmLabel: 'Supprimer' }))) return
              await writer.remove('journal_entries', e.id)
              if (e.photo_path) void backend.removeFiles('trip-files', [e.photo_path]).catch(() => undefined)
            }}><Trash2 /></Button>
          )}
        </div>
      </div>
    </Card>
  )
}
