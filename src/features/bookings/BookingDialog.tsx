import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, MapPin, Plus, Trash2, X, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { useTrip } from '@/features/trips/TripContext'
import { useTripTable } from '@/lib/data'
import { BOOKING_STATUS, BOOKING_TYPES } from '@/lib/constants'
import { CURRENCY_CODES } from '@/lib/currencies'
import { fromLocalInput, toLocalInput } from '@/lib/datetime'
import { fetchRate } from '@/lib/fx'
import { isoDay } from '@/lib/format'
import { safeUrl } from '@/lib/utils'
import type { Booking, BookingStatus, BookingType, Place } from '@/lib/types'
import type { GeoResult } from '@/lib/geocode'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input, NativeSelect, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/switch'
import { PlaceSearch } from '@/components/PlaceSearch'
import { MemberPicker } from '@/components/MemberPicker'
import { useConfirm } from '@/components/ui/confirm'
import { saveExpense } from '@/features/budget/api'

const schema = z
  .object({
    title: z.string().trim().min(1, 'Un titre est requis').max(200),
    type: z.string(),
    status: z.string(),
    start_at: z.string().optional(),
    end_at: z.string().optional(),
    confirmation_code: z.string().max(100).optional(),
    price: z.string().optional(),
    currency: z.string(),
    url: z.string().optional(),
    notes: z.string().optional(),
    booking_deadline: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.start_at && v.end_at && v.end_at < v.start_at) ctx.addIssue({ code: 'custom', path: ['end_at'], message: 'La fin doit être après le début' })
    if (v.price && Number.isNaN(Number(v.price.replace(',', '.')))) ctx.addIssue({ code: 'custom', path: ['price'], message: 'Prix invalide' })
    if (v.url && !safeUrl(v.url)) ctx.addIssue({ code: 'custom', path: ['url'], message: 'Lien invalide' })
  })
type Values = z.infer<typeof schema>

type PlaceChoice = { kind: 'existing'; place: Place } | { kind: 'new'; geo: GeoResult } | null

export default function BookingDialog({ id, defaults, onClose }: { id?: string; defaults?: Record<string, unknown>; onClose: () => void }) {
  const { trip, members, me, writer } = useTrip()
  const confirm = useConfirm()
  const bookings = useTripTable(trip.id, 'bookings')
  const places = useTripTable(trip.id, 'places')
  const attendees = useTripTable(trip.id, 'booking_attendees')
  const activities = useTripTable(trip.id, 'activities')
  const expenses = useTripTable(trip.id, 'expenses')
  const existing = id ? bookings.data?.find((b) => b.id === id) : undefined
  const fromActivity = defaults?.fromActivity ? activities.data?.find((a) => a.id === defaults.fromActivity) : undefined
  const initialPlaceId = existing?.place_id ?? fromActivity?.place_id
  const initialPlace = initialPlaceId ? places.data?.find((p) => p.id === initialPlaceId) : undefined
  const [place, setPlace] = useState<PlaceChoice>(initialPlace ? { kind: 'existing', place: initialPlace } : null)
  const [attendeeIds, setAttendeeIds] = useState<string[]>(
    id ? (attendees.data ?? []).filter((a) => a.booking_id === id).map((a) => a.member_id) : members.map((m) => m.id),
  )
  const hasExpense = !!existing && (expenses.data ?? []).some((e) => e.booking_id === existing.id)
  const [createExpense, setCreateExpense] = useState(!existing)
  const [payer, setPayer] = useState(me?.id ?? members[0]?.id ?? '')

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: existing?.title ?? fromActivity?.title ?? (defaults?.title as string) ?? '',
      type: existing?.type ?? (fromActivity ? 'ticket' : (defaults?.type as string) ?? 'lodging'),
      status: existing?.status ?? (fromActivity ? 'booked' : 'booked'),
      start_at: toLocalInput(existing?.start_at) || (fromActivity?.day_date ? `${fromActivity.day_date}T${fromActivity.start_time?.slice(0, 5) ?? '09:00'}` : ''),
      end_at: toLocalInput(existing?.end_at),
      confirmation_code: existing?.confirmation_code ?? '',
      price: existing?.price?.toString() ?? fromActivity?.est_cost?.toString() ?? '',
      currency: existing?.currency ?? fromActivity?.currency ?? trip.currency,
      url: existing?.url ?? '',
      notes: existing?.notes ?? '',
      booking_deadline: existing?.booking_deadline ?? '',
    },
  })
  const errors = form.formState.errors
  const status = form.watch('status')
  const price = form.watch('price')
  const near = trip.lat != null && trip.lng != null ? { lat: trip.lat, lng: trip.lng } : null

  const submit = async (v: Values) => {
    try {
      let place_id: string | null = null
      if (place?.kind === 'existing') place_id = place.place.id
      if (place?.kind === 'new') {
        const reuse = (places.data ?? []).find((p) => p.osm_id && p.osm_id === place.geo.osm_id)
        place_id = reuse?.id ?? (await writer.insert('places', { trip_id: trip.id, name: place.geo.name, address: place.geo.label || null, lat: place.geo.lat, lng: place.geo.lng, osm_id: place.geo.osm_id })).id
      }
      const priceNum = v.price ? Number(v.price.replace(',', '.')) : null
      const row: Partial<Booking> = {
        trip_id: trip.id,
        title: v.title,
        type: v.type as BookingType,
        status: v.status as BookingStatus,
        start_at: fromLocalInput(v.start_at),
        end_at: fromLocalInput(v.end_at),
        confirmation_code: v.confirmation_code?.trim() || null,
        price: priceNum,
        currency: v.currency,
        url: v.url ? safeUrl(v.url)! : null,
        notes: v.notes || null,
        booking_deadline: v.status === 'to_book' && v.booking_deadline ? v.booking_deadline : null,
        place_id,
      }
      let bookingId = existing?.id
      if (existing) await writer.update('bookings', existing.id, row)
      else bookingId = (await writer.insert('bookings', row)).id

      const current = (attendees.data ?? []).filter((a) => a.booking_id === bookingId)
      await Promise.all(current.filter((a) => !attendeeIds.includes(a.member_id)).map((a) => writer.remove('booking_attendees', a.id)))
      const add = attendeeIds.filter((m) => !current.some((a) => a.member_id === m)).map((m) => ({ trip_id: trip.id, booking_id: bookingId!, member_id: m }))
      if (add.length) await writer.insertMany('booking_attendees', add)

      if (fromActivity) await writer.update('activities', fromActivity.id, { linked_booking_id: bookingId!, booking_status: 'booked', needs_booking: true })

      // dépense liée automatique
      if (createExpense && !hasExpense && priceNum && v.status !== 'to_book' && v.status !== 'cancelled' && payer) {
        try {
          const day = row.start_at ? row.start_at.slice(0, 10) : isoDay()
          const rate = await fetchRate(v.currency, trip.currency, isoDay() < day ? isoDay() : day)
          await saveExpense(writer, trip.id, {
            title: v.title, amount: priceNum, currency: v.currency, fx_rate: rate, date: isoDay(),
            category: BOOKING_TYPES[v.type as BookingType].budget, paid_by: payer, split_mode: 'equal',
            split: (attendeeIds.length ? attendeeIds : members.map((m) => m.id)).map((m) => ({ member_id: m })),
            booking_id: bookingId, activity_id: fromActivity?.id ?? null,
          })
          toast.success('Dépense liée ajoutée au budget')
        } catch (e) {
          toast.error(`Dépense non créée : ${e instanceof Error ? e.message : 'erreur'}. Ajoute-la depuis la réservation.`)
        }
      }
      toast.success(existing ? 'Réservation mise à jour' : 'Réservation ajoutée')
      onClose()
    } catch {
      /* toast déjà affiché */
    }
  }

  const remove = async () => {
    if (!existing) return
    if (!(await confirm({ title: `Supprimer « ${existing.title} » ?`, description: 'Les dépenses liées sont conservées.', confirmLabel: 'Supprimer', destructive: true }))) return
    await writer.remove('bookings', existing.id)
    toast.success('Réservation supprimée')
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent wide>
        <form onSubmit={form.handleSubmit(submit)} className="flex min-h-0 flex-1 flex-col" noValidate>
          <DialogHeader><DialogTitle>{existing ? 'Modifier la réservation' : 'Nouvelle réservation'}</DialogTitle></DialogHeader>
          <DialogBody className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Type" htmlFor="bk-type">
                <NativeSelect id="bk-type" {...form.register('type')}>
                  {Object.entries(BOOKING_TYPES).map(([k, t]) => <option key={k} value={k}>{t.emoji} {t.label}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Statut" htmlFor="bk-status">
                <NativeSelect id="bk-status" {...form.register('status')}>
                  {Object.entries(BOOKING_STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
                </NativeSelect>
              </Field>
            </div>
            <Field label="Titre" htmlFor="bk-title" error={errors.title?.message}>
              <Input id="bk-title" placeholder="Vol Paris → Lisbonne, Airbnb Alfama…" autoFocus={!existing} aria-invalid={!!errors.title} {...form.register('title')} />
            </Field>
            {status === 'to_book' && (
              <Field label="À réserver avant le" htmlFor="bk-deadline" hint="Apparaît dans l’onglet « À réserver »."><Input id="bk-deadline" type="date" {...form.register('booking_deadline')} /></Field>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Début (date et heure)" htmlFor="bk-start"><Input id="bk-start" type="datetime-local" {...form.register('start_at')} /></Field>
              <Field label="Fin" htmlFor="bk-end" error={errors.end_at?.message}><Input id="bk-end" type="datetime-local" {...form.register('end_at')} /></Field>
            </div>
            <Field label="Lieu" htmlFor="bk-place">
              {place ? (
                <div className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2">
                  <MapPin className="h-4 w-4 shrink-0 text-coral" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{place.kind === 'existing' ? place.place.name : place.geo.name}</span>
                  <Button variant="ghost" size="icon-sm" aria-label="Retirer le lieu" onClick={() => setPlace(null)}><X /></Button>
                </div>
              ) : (
                <PlaceSearch id="bk-place" near={near} onSelect={(geo) => setPlace({ kind: 'new', geo })} placeholder="Hôtel, gare, aéroport…" />
              )}
            </Field>
            <Field label="Numéro de confirmation" htmlFor="bk-code">
              <Input id="bk-code" className="font-mono uppercase tracking-wider" autoCapitalize="characters" placeholder="ABC123" {...form.register('confirmation_code')} />
            </Field>
            <div className="grid grid-cols-[1fr_7rem] gap-3">
              <Field label="Prix total" htmlFor="bk-price" error={errors.price?.message}><Input id="bk-price" inputMode="decimal" placeholder="0" {...form.register('price')} /></Field>
              <Field label="Devise" htmlFor="bk-cur">
                <NativeSelect id="bk-cur" {...form.register('currency')}>{CURRENCY_CODES.map((c) => <option key={c}>{c}</option>)}</NativeSelect>
              </Field>
            </div>
            {price && !hasExpense && status !== 'to_book' && status !== 'cancelled' && (
              <div className="space-y-2 rounded-2xl bg-success/10 p-3">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <Checkbox checked={createExpense} onCheckedChange={(c) => setCreateExpense(!!c)} /> <Wallet className="h-4 w-4 text-success" /> Créer la dépense liée
                </label>
                {createExpense && (
                  <Field label="Payé par" htmlFor="bk-payer">
                    <NativeSelect id="bk-payer" value={payer} onChange={(e) => setPayer(e.target.value)}>
                      {members.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
                    </NativeSelect>
                  </Field>
                )}
                <p className="text-xs text-muted-foreground">Répartie à parts égales entre les participants concernés.</p>
              </div>
            )}
            <Field label="Lien (réservation, site)" htmlFor="bk-url" error={errors.url?.message}><Input id="bk-url" type="url" inputMode="url" placeholder="https://…" {...form.register('url')} /></Field>
            <div className="space-y-2">
              <span className="text-sm font-semibold">Participants concernés</span>
              <MemberPicker members={members} value={attendeeIds} onChange={setAttendeeIds} />
            </div>
            <Field label="Notes" htmlFor="bk-notes"><Textarea id="bk-notes" rows={2} placeholder="Check-in à partir de 15h, code boîte à clés…" {...form.register('notes')} /></Field>
            {!existing && <p className="text-xs text-muted-foreground">Tu pourras joindre billets et PDF depuis la fiche de la réservation.</p>}
          </DialogBody>
          <DialogFooter>
            {existing && <Button variant="ghost" className="text-destructive sm:mr-auto" onClick={remove}><Trash2 /> Supprimer</Button>}
            <Button variant="ghost" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : !existing && <Plus />} {existing ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
