import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Download, ImagePlus, Images, Loader2, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { zipSync } from 'fflate'
import { useTrip } from './TripContext'
import { useTripTable } from '@/lib/data'
import { backend } from '@/lib/backend'
import { compressImage, uploadTripFile, useFileUrl } from '@/lib/files'
import { fmtAgo, fmtDay, isoDay } from '@/lib/format'
import { PageTitle } from '@/components/PageTitle'
import { ScrollRow } from '@/components/ScrollRow'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import { useConfirm } from '@/components/ui/confirm'
import { cn } from '@/lib/utils'

interface Photo {
  key: string
  path: string
  name: string
  by: string | null
  at: string
  day: string
  source: { label: string; to: string } | null
  attachmentId?: string
  deletable: boolean
}

/** Album partagé : photos de l'album, du journal et des pièces jointes */
export default function AlbumPage() {
  const { trip, canEdit, writer, memberByUser, members } = useTrip()
  const attachments = useTripTable(trip.id, 'attachments')
  const journal = useTripTable(trip.id, 'journal_entries')
  const activities = useTripTable(trip.id, 'activities')
  const bookings = useTripTable(trip.id, 'bookings')
  const [who, setWho] = useState<string>('all')
  const [busy, setBusy] = useState(false)
  const [zipping, setZipping] = useState(false)
  const [open, setOpen] = useState<number | null>(null)
  const base = `/t/${trip.id}`

  const photos: Photo[] = useMemo(() => {
    const out: Photo[] = []
    for (const a of attachments.data ?? []) {
      if (!a.mime?.startsWith('image/')) continue
      const act = a.parent_type === 'activity' ? activities.data?.find((x) => x.id === a.parent_id) : undefined
      const bk = a.parent_type === 'booking' ? bookings.data?.find((x) => x.id === a.parent_id) : undefined
      out.push({
        key: `a${a.id}`, path: a.storage_path, name: a.file_name, by: a.updated_by ?? null, at: a.created_at, day: isoDay(new Date(a.created_at)),
        source: act ? { label: act.title, to: `${base}/activities/${act.id}` } : bk ? { label: bk.title, to: `${base}/bookings/${bk.id}` } : null,
        attachmentId: a.id, deletable: a.parent_type === 'album',
      })
    }
    for (const j of journal.data ?? []) {
      if (!j.photo_path) continue
      out.push({ key: `j${j.id}`, path: j.photo_path, name: `journal-${j.id}.jpg`, by: j.author_id, at: j.created_at, day: j.day_date ?? isoDay(new Date(j.created_at)), source: { label: 'Journal', to: `${base}/journal` }, deletable: false })
    }
    return out.sort((a, b) => b.at.localeCompare(a.at))
  }, [attachments.data, journal.data, activities.data, bookings.data, base])

  const filtered = photos.filter((p) => who === 'all' || p.by === who)
  const contributors = members.filter((m) => m.user_id && photos.some((p) => p.by === m.user_id))
  const byDay = useMemo(() => {
    const g: { day: string; items: { p: Photo; i: number }[] }[] = []
    filtered.forEach((p, i) => {
      const last = g.at(-1)
      if (last?.day === p.day) last.items.push({ p, i })
      else g.push({ day: p.day, items: [{ p, i }] })
    })
    return g
  }, [filtered])

  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    let done = 0
    try {
      for (const raw of Array.from(files)) {
        if (!raw.type.startsWith('image/')) continue
        const file = await compressImage(raw, 2200, 0.85)
        const path = await uploadTripFile(trip.id, file, 'album')
        await writer.insert('attachments', { trip_id: trip.id, parent_type: 'album', parent_id: trip.id, storage_path: path, file_name: raw.name, mime: file.type, size: file.size })
        done++
      }
      toast.success(`${done} photo${done > 1 ? 's' : ''} ajoutée${done > 1 ? 's' : ''} 📸`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Envoi impossible')
    } finally {
      setBusy(false)
    }
  }

  const downloadAll = async () => {
    setZipping(true)
    try {
      const files: Record<string, Uint8Array> = {}
      let n = 0
      for (const p of filtered) {
        const url = await backend.fileUrl('trip-files', p.path)
        const buf = new Uint8Array(await (await fetch(url)).arrayBuffer())
        n++
        files[`${String(n).padStart(3, '0')}-${p.day}-${p.name.replace(/[^\w.-]+/g, '-')}`] = buf
      }
      const zip = zipSync(files, { level: 0 })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([zip], { type: 'application/zip' }))
      a.download = `album-${trip.name.normalize('NFD').replace(/[^\w]+/g, '-').toLowerCase()}.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 2000)
    } catch {
      toast.error('Téléchargement impossible')
    } finally {
      setZipping(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageTitle title="Album" subtitle={`${photos.length} photo${photos.length > 1 ? 's' : ''} partagée${photos.length > 1 ? 's' : ''}`}
        action={<div className="flex gap-2">
          {filtered.length > 0 && <Button variant="outline" onClick={downloadAll} disabled={zipping} aria-label="Tout télécharger">{zipping ? <Loader2 className="animate-spin" /> : <Download />}<span className="hidden sm:inline">Tout télécharger</span></Button>}
          {canEdit && (
            <Button asChild disabled={busy}>
              <label className="cursor-pointer">{busy ? <Loader2 className="animate-spin" /> : <ImagePlus />} Ajouter
                <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { void upload(e.target.files); e.target.value = '' }} />
              </label>
            </Button>
          )}
        </div>} />
      {contributors.length > 1 && (
        <ScrollRow>
          <button onClick={() => setWho('all')} aria-pressed={who === 'all'} className={cn('shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold', who === 'all' ? 'border-primary bg-primary text-primary-foreground' : 'bg-card')}>Tout le monde</button>
          {contributors.map((m) => (
            <button key={m.id} onClick={() => setWho(m.user_id!)} aria-pressed={who === m.user_id}
              className={cn('flex shrink-0 items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-xs font-semibold', who === m.user_id ? 'border-primary bg-primary text-primary-foreground' : 'bg-card')}>
              <Avatar name={m.display_name} color={m.color} size="xs" className="ring-0" /> {m.display_name}
            </button>
          ))}
        </ScrollRow>
      )}
      {!filtered.length ? (
        <EmptyState icon={Images} title="Aucune photo pour l’instant" description="Ajoutez vos photos au fil du voyage : tout le groupe les retrouve ici, et vous pourrez tout télécharger à la fin." />
      ) : (
        byDay.map((g) => (
          <section key={g.day}>
            <h2 className="mb-2 text-sm font-bold text-muted-foreground first-letter:uppercase">{fmtDay(g.day)}</h2>
            <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 sm:gap-2 lg:grid-cols-6">
              {g.items.map(({ p, i }) => <Thumb key={p.key} photo={p} onOpen={() => setOpen(i)} />)}
            </div>
          </section>
        ))
      )}
      {open !== null && filtered[open] && (
        <Lightbox photos={filtered} index={open} setIndex={setOpen} onClose={() => setOpen(null)} memberName={(u) => (u ? memberByUser[u]?.display_name : undefined) ?? '—'} canEdit={canEdit}
          onDelete={async (p) => { if (p.attachmentId) { await writer.remove('attachments', p.attachmentId); void backend.removeFiles('trip-files', [p.path]).catch(() => undefined) } }} />
      )}
    </div>
  )
}

function Thumb({ photo, onOpen }: { photo: Photo; onOpen: () => void }) {
  const url = useFileUrl(photo.path)
  return (
    <button onClick={onOpen} className="group relative aspect-square overflow-hidden rounded-xl bg-muted focus-visible:ring-2" aria-label={`Ouvrir ${photo.name}`}>
      {url.data && <img src={url.data} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />}
    </button>
  )
}

function Lightbox({ photos, index, setIndex, onClose, memberName, canEdit, onDelete }: {
  photos: Photo[]; index: number; setIndex: (i: number) => void; onClose: () => void; memberName: (u: string | null) => string; canEdit: boolean; onDelete: (p: Photo) => Promise<void>
}) {
  const confirm = useConfirm()
  const p = photos[index]
  const url = useFileUrl(p.path)
  const touch = useRef<number | null>(null)
  const go = useCallback((d: number) => setIndex((index + d + photos.length) % photos.length), [index, photos.length, setIndex])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [go, onClose])
  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-black/95 text-white" role="dialog" aria-modal="true" aria-label="Visionneuse"
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => { if (touch.current == null) return; const dx = e.changedTouches[0].clientX - touch.current; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); touch.current = null }}>
      <div className="flex items-center gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold">{memberName(p.by)} · {fmtAgo(p.at)}</p>
          {p.source && <Link to={p.source.to} className="text-xs text-white/70 underline" onClick={onClose}>{p.source.label}</Link>}
        </div>
        <span className="text-xs text-white/60">{index + 1} / {photos.length}</span>
        {url.data && <a href={url.data} download={p.name} target="_blank" rel="noreferrer" className="rounded-full p-2 hover:bg-white/10" aria-label="Télécharger"><Download className="h-5 w-5" /></a>}
        {canEdit && p.deletable && (
          <button className="rounded-full p-2 hover:bg-white/10" aria-label="Supprimer la photo" onClick={async () => {
            if (!(await confirm({ title: 'Supprimer cette photo ?', destructive: true, confirmLabel: 'Supprimer' }))) return
            await onDelete(p)
            if (photos.length <= 1) onClose()
            else setIndex(Math.min(index, photos.length - 2))
          }}><Trash2 className="h-5 w-5" /></button>
        )}
        <button className="rounded-full p-2 hover:bg-white/10" aria-label="Fermer" onClick={onClose}><X className="h-6 w-6" /></button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        {url.data ? <img src={url.data} alt={p.name} className="max-h-full max-w-full object-contain" /> : <Loader2 className="h-8 w-8 animate-spin" />}
        {photos.length > 1 && (
          <>
            <button onClick={() => go(-1)} className="absolute left-2 hidden rounded-full bg-white/10 p-3 hover:bg-white/20 sm:block" aria-label="Photo précédente"><ChevronLeft className="h-6 w-6" /></button>
            <button onClick={() => go(1)} className="absolute right-2 hidden rounded-full bg-white/10 p-3 hover:bg-white/20 sm:block" aria-label="Photo suivante"><ChevronRight className="h-6 w-6" /></button>
          </>
        )}
      </div>
    </div>
  )
}
