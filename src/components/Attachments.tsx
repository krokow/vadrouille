import { useState } from 'react'
import { FileText, Image as ImageIcon, Loader2, Paperclip, Trash2, Download } from 'lucide-react'
import { toast } from 'sonner'
import { useTrip } from '@/features/trips/TripContext'
import { useTripTable } from '@/lib/data'
import { backend } from '@/lib/backend'
import { compressImage, uploadTripFile, useFileUrl } from '@/lib/files'
import type { Attachment, ParentType } from '@/lib/types'
import { Button } from './ui/button'
import { useConfirm } from './ui/confirm'
import { cn } from '@/lib/utils'

export function useAttachments(parentType: ParentType, parentId: string) {
  const { trip } = useTrip()
  const q = useTripTable(trip.id, 'attachments')
  return (q.data ?? []).filter((a) => a.parent_type === parentType && a.parent_id === parentId)
}

/** Liste + envoi de pièces jointes (PDF, billets, captures) */
export function Attachments({ parentType, parentId, large }: { parentType: ParentType; parentId: string; large?: boolean }) {
  const { trip, canEdit, writer } = useTrip()
  const files = useAttachments(parentType, parentId)
  const [busy, setBusy] = useState(false)
  const confirm = useConfirm()

  const upload = async (list: FileList | null) => {
    if (!list?.length) return
    setBusy(true)
    try {
      for (const raw of Array.from(list)) {
        const file = raw.type.startsWith('image/') ? await compressImage(raw, 2200, 0.88) : raw
        const path = await uploadTripFile(trip.id, file, parentType)
        await writer.insert('attachments', { trip_id: trip.id, parent_type: parentType, parent_id: parentId, storage_path: path, file_name: raw.name, mime: file.type || null, size: file.size })
      }
      toast.success(list.length > 1 ? 'Fichiers ajoutés' : 'Fichier ajouté')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Envoi impossible')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (a: Attachment) => {
    if (!(await confirm({ title: `Supprimer « ${a.file_name} » ?`, confirmLabel: 'Supprimer', destructive: true }))) return
    await writer.remove('attachments', a.id)
    void backend.removeFiles('trip-files', [a.storage_path]).catch(() => undefined)
  }

  return (
    <div className="space-y-2">
      {files.length > 0 && (
        <ul className={cn('grid gap-2', large ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2')}>
          {files.map((f) => <AttachmentItem key={f.id} file={f} large={large} onRemove={canEdit ? () => remove(f) : undefined} />)}
        </ul>
      )}
      {canEdit && (
        <Button variant="outline" size="sm" asChild disabled={busy}>
          <label className="cursor-pointer">
            {busy ? <Loader2 className="animate-spin" /> : <Paperclip />} Joindre un fichier
            <input type="file" multiple accept="image/*,application/pdf,.pdf,.pkpass,.txt,.doc,.docx" className="sr-only" disabled={busy} onChange={(e) => { void upload(e.target.files); e.target.value = '' }} />
          </label>
        </Button>
      )}
    </div>
  )
}

function AttachmentItem({ file, large, onRemove }: { file: Attachment; large?: boolean; onRemove?: () => void }) {
  const url = useFileUrl(file.storage_path)
  const isImage = file.mime?.startsWith('image/')
  return (
    <li className="overflow-hidden rounded-2xl border bg-card">
      {isImage && large && url.data && <img src={url.data} alt={file.file_name} className="max-h-[60vh] w-full bg-white object-contain" />}
      <div className="flex items-center gap-2 p-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted">
          {isImage && url.data && !large ? <img src={url.data} alt="" className="h-9 w-9 rounded-xl object-cover" /> : isImage ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4 text-coral" />}
        </span>
        <a href={url.data} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm font-semibold hover:underline">{file.file_name}</a>
        {url.data && (
          <Button variant="ghost" size="icon-sm" asChild aria-label="Ouvrir"><a href={url.data} target="_blank" rel="noreferrer" download={file.file_name}><Download /></a></Button>
        )}
        {onRemove && <Button variant="ghost" size="icon-sm" aria-label="Supprimer le fichier" onClick={onRemove}><Trash2 /></Button>}
      </div>
    </li>
  )
}
