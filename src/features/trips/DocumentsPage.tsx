import { useState } from 'react'
import { AlertTriangle, Download, FileLock2, Globe2, Loader2, Lock, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useTrip } from './TripContext'
import { useTripTable } from '@/lib/data'
import { backend } from '@/lib/backend'
import { uid } from '@/lib/ids'
import { compressImage, useFileUrl } from '@/lib/files'
import { fmtDay } from '@/lib/format'
import { daysUntil } from '@/lib/dates'
import type { DocumentKind, TripDocument } from '@/lib/types'
import { PageTitle } from '@/components/PageTitle'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input, NativeSelect } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { EmptyState } from '@/components/ui/empty-state'
import { useConfirm } from '@/components/ui/confirm'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const KINDS: Record<DocumentKind, { label: string; emoji: string }> = {
  passport: { label: 'Passeport', emoji: '🛂' },
  id: { label: 'Carte d’identité', emoji: '🪪' },
  insurance: { label: 'Assurance', emoji: '🛟' },
  visa: { label: 'Visa / ESTA', emoji: '📄' },
  health: { label: 'Santé (vaccins, carte européenne)', emoji: '💉' },
  license: { label: 'Permis de conduire', emoji: '🚗' },
  other: { label: 'Autre', emoji: '📎' },
}

export default function DocumentsPage() {
  const { trip, userId, memberByUser } = useTrip()
  const docs = useTripTable(trip.id, 'documents')
  const [adding, setAdding] = useState(false)
  const mineList = (docs.data ?? []).filter((d) => d.owner_id === userId)
  const shared = (docs.data ?? []).filter((d) => d.owner_id !== userId)
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageTitle title="Documents" subtitle="Passeports, assurances, visas… à portée de main" action={<Button onClick={() => setAdding(true)}><Plus /> Ajouter</Button>} />
      <p className="flex items-start gap-2 rounded-2xl bg-accent p-3 text-xs text-accent-foreground">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" />
        Les documents <strong>privés</strong> ne sont visibles que par toi (protégés côté base de données). Les documents <strong>partagés</strong> sont visibles par tout le groupe.
      </p>
      {!docs.data?.length ? (
        <EmptyState icon={FileLock2} title="Aucun document" description="Dépose une copie de ton passeport ou l’attestation d’assurance : utile en cas de perte." />
      ) : (
        <>
          {mineList.length > 0 && <section className="space-y-2"><h2 className="text-sm font-bold text-muted-foreground">Mes documents</h2>{mineList.map((d) => <DocRow key={d.id} doc={d} mine />)}</section>}
          {shared.length > 0 && <section className="space-y-2"><h2 className="text-sm font-bold text-muted-foreground">Partagés par le groupe</h2>{shared.map((d) => <DocRow key={d.id} doc={d} owner={memberByUser[d.owner_id]?.display_name} />)}</section>}
        </>
      )}
      {adding && <AddDocument onClose={() => setAdding(false)} />}
    </div>
  )
}

function DocRow({ doc, mine, owner }: { doc: TripDocument; mine?: boolean; owner?: string }) {
  const { trip, writer } = useTrip()
  const confirm = useConfirm()
  const url = useFileUrl(doc.storage_path)
  const end = trip.end_date ?? trip.start_date
  const expiresBeforeEnd = doc.expires_on && end && doc.expires_on < end
  const soon = doc.expires_on && (daysUntil(doc.expires_on) ?? 999) < 180
  return (
    <Card className="flex items-center gap-3 p-3">
      <span className="text-2xl" aria-hidden>{KINDS[doc.kind].emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{doc.title}</p>
        <div className="mt-0.5 flex flex-wrap gap-1">
          {doc.visibility === 'private' ? <Badge variant="secondary"><Lock /> Privé</Badge> : <Badge><Globe2 /> Partagé{owner ? ` par ${owner}` : ''}</Badge>}
          {doc.expires_on && (
            <Badge variant={expiresBeforeEnd ? 'destructive' : soon ? 'warning' : 'outline'}>
              {expiresBeforeEnd && <AlertTriangle />} Expire le {fmtDay(doc.expires_on)}{expiresBeforeEnd ? ' (avant la fin du voyage !)' : ''}
            </Badge>
          )}
        </div>
      </div>
      {url.data && <Button asChild variant="ghost" size="icon" aria-label="Ouvrir"><a href={url.data} target="_blank" rel="noreferrer"><Download /></a></Button>}
      {mine && (
        <Button variant="ghost" size="icon" aria-label="Supprimer" onClick={async () => {
          if (!(await confirm({ title: `Supprimer « ${doc.title} » ?`, destructive: true, confirmLabel: 'Supprimer' }))) return
          await writer.remove('documents', doc.id)
          if (doc.storage_path) void backend.removeFiles('trip-files', [doc.storage_path]).catch(() => undefined)
        }}><Trash2 /></Button>
      )}
    </Card>
  )
}

function AddDocument({ onClose }: { onClose: () => void }) {
  const { trip, userId, writer } = useTrip()
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<DocumentKind>('passport')
  const [visibility, setVisibility] = useState<'private' | 'trip'>('private')
  const [expires, setExpires] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true)
    try {
      let storage_path: string | null = null
      if (file) {
        const f = file.type.startsWith('image/') ? await compressImage(file, 2200, 0.9) : file
        const safe = f.name.normalize('NFD').replace(/[^\w.-]+/g, '-').slice(-60)
        storage_path = visibility === 'private' ? `${trip.id}/private/${userId}/${uid()}-${safe}` : `${trip.id}/documents/${uid()}-${safe}`
        await backend.upload('trip-files', storage_path, f)
      }
      await writer.insert('documents', {
        trip_id: trip.id, owner_id: userId, title: title.trim() || KINDS[kind].label, kind, visibility,
        storage_path, file_name: file?.name ?? null, mime: file?.type ?? null, expires_on: expires || null,
      })
      toast.success('Document ajouté')
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Envoi impossible')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nouveau document</DialogTitle><DialogDescription>Formats : PDF ou photo.</DialogDescription></DialogHeader>
        <DialogBody className="space-y-4">
          <Field label="Type" htmlFor="doc-kind">
            <NativeSelect id="doc-kind" value={kind} onChange={(e) => setKind(e.target.value as DocumentKind)}>
              {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Titre" htmlFor="doc-title"><Input id="doc-title" placeholder={KINDS[kind].label} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label="Visibilité" htmlFor="doc-vis">
            <NativeSelect id="doc-vis" value={visibility} onChange={(e) => setVisibility(e.target.value as 'private' | 'trip')}>
              <option value="private">🔒 Privé (moi uniquement)</option>
              <option value="trip">🌍 Partagé avec le groupe</option>
            </NativeSelect>
          </Field>
          <Field label="Date d’expiration" htmlFor="doc-exp" hint="On t’alerte si elle tombe avant la fin du voyage."><Input id="doc-exp" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} /></Field>
          <Field label="Fichier" htmlFor="doc-file"><Input id="doc-file" type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={save} disabled={busy}>{busy && <Loader2 className="animate-spin" />} Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
