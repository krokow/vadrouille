import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Copy, Loader2, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useTrip } from './TripContext'
import { TripFormDialog } from './TripForm'
import { duplicateTrip } from './duplicate'
import { qk } from '@/lib/data'
import { fmtDateRange } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { useConfirm } from '@/components/ui/confirm'
import { PageTitle } from '@/components/PageTitle'
import { TripCover } from './TripCover'

export function SettingsPage() {
  const { trip, canEdit, isOwner, writer, userId } = useTrip()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const confirm = useConfirm()
  const [editing, setEditing] = useState(false)
  const [dupName, setDupName] = useState(`${trip.name} (copie)`)
  const [dupDate, setDupDate] = useState('')
  const [duplicating, setDuplicating] = useState(false)
  const [notes, setNotes] = useState(trip.notes ?? '')

  const duplicate = async () => {
    setDuplicating(true)
    try {
      const id = await duplicateTrip(trip, { name: dupName.trim() || trip.name, startDate: dupDate || null, userId })
      await qc.invalidateQueries({ queryKey: qk.trips })
      await qc.invalidateQueries({ queryKey: qk.allMembers })
      toast.success('Voyage dupliqué')
      navigate(`/t/${id}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Duplication impossible')
    } finally {
      setDuplicating(false)
    }
  }

  const remove = async () => {
    const ok = await confirm({
      title: `Supprimer « ${trip.name} » ?`,
      description: 'Toutes les activités, réservations, dépenses et fichiers seront définitivement supprimés pour tout le monde.',
      confirmLabel: 'Supprimer définitivement', destructive: true,
    })
    if (!ok) return
    await writer.remove('trips', trip.id)
    toast.success('Voyage supprimé')
    navigate('/')
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageTitle title="Paramètres du voyage" />
      <Card className="overflow-hidden">
        <TripCover trip={trip} className="h-32" />
        <CardContent className="flex items-center justify-between gap-3 pt-4">
          <div className="min-w-0">
            <p className="truncate font-semibold">{trip.name}</p>
            <p className="text-sm text-muted-foreground">{[trip.destination, fmtDateRange(trip.start_date, trip.end_date), trip.currency].filter(Boolean).join(' · ')}</p>
          </div>
          {canEdit && <Button variant="outline" onClick={() => setEditing(true)}><Pencil /> Modifier</Button>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Notes générales</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canEdit} rows={4}
            placeholder="Infos utiles pour tout le groupe : codes Wi-Fi, numéros d’urgence, adresse du logement…" />
          {canEdit && notes !== (trip.notes ?? '') && (
            <Button size="sm" onClick={() => writer.update('trips', trip.id, { notes: notes || null }).then(() => toast.success('Notes enregistrées'))}>Enregistrer</Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Copy className="h-4 w-4 text-primary" /> Utiliser comme modèle</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Crée un nouveau voyage avec les mêmes lieux, activités (décalées aux nouvelles dates), budget prévisionnel et liste de bagages. Les dépenses et réservations ne sont pas copiées.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nom" htmlFor="dup-name"><Input id="dup-name" value={dupName} onChange={(e) => setDupName(e.target.value)} /></Field>
            <Field label="Nouvelle date de début" htmlFor="dup-date" hint="Laisser vide : dates à définir"><Input id="dup-date" type="date" value={dupDate} onChange={(e) => setDupDate(e.target.value)} /></Field>
          </div>
          <Button variant="outline" onClick={duplicate} disabled={duplicating}>{duplicating ? <Loader2 className="animate-spin" /> : <Copy />} Dupliquer</Button>
        </CardContent>
      </Card>

      {isOwner && (
        <Card className="border-destructive/40">
          <CardHeader><CardTitle className="text-destructive">Zone sensible</CardTitle></CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={remove}><Trash2 /> Supprimer le voyage</Button>
          </CardContent>
        </Card>
      )}
      {editing && <TripFormDialog trip={trip} open={editing} onOpenChange={setEditing} />}
    </div>
  )
}
