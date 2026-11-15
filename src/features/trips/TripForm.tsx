import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Trip } from '@/lib/types'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input, NativeSelect } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { PlaceSearch } from '@/components/PlaceSearch'
import { CURRENCIES } from '@/lib/currencies'
import { useWriter } from '@/lib/data'
import { useAuth } from '@/features/auth/AuthProvider'
import { compressImage, uploadTripFile } from '@/lib/files'
import { uid, randomToken } from '@/lib/ids'
import { TripCover } from './TripCover'

const schema = z
  .object({
    name: z.string().trim().min(1, 'Donne un nom au voyage').max(120),
    destination: z.string().trim().max(200).optional(),
    lat: z.number().nullable(),
    lng: z.number().nullable(),
    undated: z.boolean(),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    currency: z.string().length(3),
  })
  .superRefine((v, ctx) => {
    if (v.undated) return
    if (!v.start_date) ctx.addIssue({ code: 'custom', path: ['start_date'], message: 'Date de début requise (ou coche « dates à définir »)' })
    if (v.start_date && v.end_date && v.end_date < v.start_date)
      ctx.addIssue({ code: 'custom', path: ['end_date'], message: 'La fin doit être après le début' })
  })
type Values = z.infer<typeof schema>

export function TripFormDialog({ trip, open, onOpenChange }: { trip?: Trip; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { user, profile } = useAuth()
  const writer = useWriter(user?.id)
  const navigate = useNavigate()
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [removeCover, setRemoveCover] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: trip?.name ?? '',
      destination: trip?.destination ?? '',
      lat: trip?.lat ?? null,
      lng: trip?.lng ?? null,
      undated: trip ? !trip.start_date : false,
      start_date: trip?.start_date ?? '',
      end_date: trip?.end_date ?? '',
      currency: trip?.currency ?? profile?.preferred_currency ?? 'EUR',
    },
  })
  const undated = form.watch('undated')
  const errors = form.formState.errors

  const submit = async (v: Values) => {
    const id = trip?.id ?? uid()
    try {
      let cover_url = removeCover ? null : trip?.cover_url ?? null
      const row: Partial<Trip> = {
        name: v.name,
        destination: v.destination || null,
        lat: v.lat, lng: v.lng,
        start_date: v.undated ? null : v.start_date || null,
        end_date: v.undated ? null : v.end_date || v.start_date || null,
        currency: v.currency,
      }
      if (trip) {
        if (coverFile) cover_url = await uploadTripFile(id, await compressImage(coverFile), 'cover')
        await writer.update('trips', id, { ...row, cover_url })
        toast.success('Voyage mis à jour')
      } else {
        await writer.insert('trips', { ...row, id, created_by: user!.id, invite_token: randomToken(), invite_enabled: true, cover_url: null })
        // la couverture est envoyée après la création (les droits Storage dépendent de l'appartenance au voyage)
        if (coverFile) {
          const path = await uploadTripFile(id, await compressImage(coverFile), 'cover')
          await writer.update('trips', id, { cover_url: path })
        }
        toast.success('Voyage créé, bon voyage ! 🎒')
        navigate(`/t/${id}`)
      }
      onOpenChange(false)
    } catch {
      /* toast déjà affiché */
    }
  }

  const coverPreviewTrip = { id: trip?.id ?? 'new', name: form.watch('name'), cover_url: removeCover ? null : preview ?? trip?.cover_url ?? null }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={form.handleSubmit(submit)} className="flex min-h-0 flex-1 flex-col" noValidate>
          <DialogHeader>
            <DialogTitle>{trip ? 'Modifier le voyage' : 'Nouveau voyage'}</DialogTitle>
            <DialogDescription>Tu pourras tout changer plus tard.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Field label="Nom du voyage" htmlFor="trip-name" error={errors.name?.message}>
              <Input id="trip-name" placeholder="Week-end à Lisbonne" aria-invalid={!!errors.name} {...form.register('name')} autoFocus={!trip} />
            </Field>
            <Field label="Destination" htmlFor="trip-dest">
              <Controller
                control={form.control}
                name="destination"
                render={({ field }) => (
                  <PlaceSearch
                    id="trip-dest"
                    value={field.value}
                    placeholder="Ville, région, pays…"
                    onSelect={(r) => {
                      field.onChange(r.label ? `${r.name}, ${r.label.split(', ').at(-1)}` : r.name)
                      form.setValue('lat', r.lat)
                      form.setValue('lng', r.lng)
                    }}
                    onClear={() => {
                      field.onChange('')
                      form.setValue('lat', null)
                      form.setValue('lng', null)
                    }}
                  />
                )}
              />
            </Field>
            <div className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2">
              <label htmlFor="undated" className="text-sm font-semibold">Dates à définir</label>
              <Controller control={form.control} name="undated" render={({ field }) => (
                <Switch id="undated" checked={field.value} onCheckedChange={field.onChange} />
              )} />
            </div>
            {!undated && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Début" htmlFor="trip-start" error={errors.start_date?.message}>
                  <Input id="trip-start" type="date" aria-invalid={!!errors.start_date} {...form.register('start_date')} />
                </Field>
                <Field label="Fin" htmlFor="trip-end" error={errors.end_date?.message}>
                  <Input id="trip-end" type="date" min={form.watch('start_date')} aria-invalid={!!errors.end_date} {...form.register('end_date')} />
                </Field>
              </div>
            )}
            <Field label="Devise principale" htmlFor="trip-cur" hint="Toutes les dépenses seront converties dans cette devise.">
              <NativeSelect id="trip-cur" {...form.register('currency')}>
                {CURRENCIES.map(([c, n]) => <option key={c} value={c}>{c} — {n}</option>)}
              </NativeSelect>
            </Field>
            <div className="space-y-1.5">
              <span className="text-sm font-semibold">Photo de couverture</span>
              <TripCover trip={coverPreviewTrip} className="h-28 rounded-2xl">
                <div className="flex h-full items-end justify-end gap-2 p-2">
                  {(coverPreviewTrip.cover_url) && (
                    <Button size="sm" variant="secondary" onClick={() => { setRemoveCover(true); setCoverFile(null); setPreview(null) }}>
                      <Trash2 /> Retirer
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" asChild>
                    <label className="cursor-pointer">
                      <ImagePlus /> {coverPreviewTrip.cover_url ? 'Changer' : 'Ajouter une photo'}
                      <input
                        type="file" accept="image/*" className="sr-only"
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (!f) return
                          setCoverFile(f)
                          setRemoveCover(false)
                          setPreview(URL.createObjectURL(f))
                        }}
                      />
                    </label>
                  </Button>
                </div>
              </TripCover>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
              {trip ? 'Enregistrer' : 'Créer le voyage'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
