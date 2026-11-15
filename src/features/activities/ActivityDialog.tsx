import { useMemo, useState } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertTriangle, ChevronDown, Link2, Loader2, MapPin, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { useTrip } from '@/features/trips/TripContext'
import { useTripTable } from '@/lib/data'
import { ACTIVITY_CATEGORIES, ATTENTION_FIELDS } from '@/lib/constants'
import { CURRENCY_CODES } from '@/lib/currencies'
import { tripDays } from '@/lib/dates'
import { fmtDay } from '@/lib/format'
import { uid } from '@/lib/ids'
import { safeUrl } from '@/lib/utils'
import type { Activity, ActivityCategory, AttentionNotes, Place } from '@/lib/types'
import type { GeoResult } from '@/lib/geocode'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input, NativeSelect, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { PlaceSearch } from '@/components/PlaceSearch'
import { MemberPicker } from '@/components/MemberPicker'
import { useConfirm } from '@/components/ui/confirm'
import { cn } from '@/lib/utils'

const schema = z
  .object({
    title: z.string().trim().min(1, 'Un titre est requis').max(200),
    description: z.string().max(4000).optional(),
    category: z.string(),
    day_date: z.string(),
    start_time: z.string().optional(),
    end_time: z.string().optional(),
    duration_min: z.string().optional(),
    est_cost: z.string().optional(),
    currency: z.string(),
    needs_booking: z.boolean(),
    booking_status: z.enum(['to_book', 'booked']),
    booking_deadline: z.string().optional(),
    linked_booking_id: z.string().optional(),
    links: z.array(z.object({ id: z.string().optional(), label: z.string().optional(), url: z.string() })),
    attention: z.record(z.string(), z.string().optional()),
    notes: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.start_time && v.end_time && v.end_time < v.start_time)
      ctx.addIssue({ code: 'custom', path: ['end_time'], message: 'La fin doit être après le début' })
    if (v.est_cost && Number.isNaN(Number(v.est_cost.replace(',', '.'))))
      ctx.addIssue({ code: 'custom', path: ['est_cost'], message: 'Montant invalide' })
    v.links.forEach((l, i) => {
      if (l.url && !safeUrl(l.url)) ctx.addIssue({ code: 'custom', path: ['links', i, 'url'], message: 'Lien invalide' })
    })
  })
type Values = z.infer<typeof schema>

interface Props {
  id?: string
  defaults?: Record<string, unknown>
  onClose: () => void
}

type PlaceChoice = { kind: 'existing'; place: Place } | { kind: 'new'; geo: GeoResult } | null

export default function ActivityDialog({ id, defaults, onClose }: Props) {
  const { trip, members, writer } = useTrip()
  const confirm = useConfirm()
  const activities = useTripTable(trip.id, 'activities')
  const places = useTripTable(trip.id, 'places')
  const links = useTripTable(trip.id, 'activity_links')
  const attendees = useTripTable(trip.id, 'activity_attendees')
  const bookings = useTripTable(trip.id, 'bookings')
  const existing = id ? activities.data?.find((a) => a.id === id) : undefined
  const existingLinks = (links.data ?? []).filter((l) => l.activity_id === id)
  const existingPlace = existing?.place_id ? places.data?.find((p) => p.id === existing.place_id) : undefined
  const defaultGeo = defaults?.place as GeoResult | undefined

  const [place, setPlace] = useState<PlaceChoice>(
    existingPlace ? { kind: 'existing', place: existingPlace } : defaultGeo ? { kind: 'new', geo: defaultGeo } : null,
  )
  const [attendeeIds, setAttendeeIds] = useState<string[]>(
    id ? (attendees.data ?? []).filter((a) => a.activity_id === id).map((a) => a.member_id) : members.map((m) => m.id),
  )
  const [showAttention, setShowAttention] = useState(existing ? Object.values(existing.attention_notes ?? {}).some(Boolean) : !!defaults?.attention_notes)
  const [showMore, setShowMore] = useState(!!existing && !!(existing.notes || existing.est_cost || existingLinks.length))

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: existing?.title ?? (defaults?.title as string) ?? '',
      description: existing?.description ?? (defaults?.description as string) ?? '',
      category: existing?.category ?? (defaults?.category as string) ?? 'visit',
      day_date: existing?.day_date ?? (defaults?.day_date as string) ?? '',
      start_time: existing?.start_time?.slice(0, 5) ?? '',
      end_time: existing?.end_time?.slice(0, 5) ?? '',
      duration_min: existing?.duration_min?.toString() ?? '',
      est_cost: existing?.est_cost?.toString() ?? '',
      currency: existing?.currency ?? trip.currency,
      needs_booking: existing?.needs_booking ?? (defaults?.needs_booking as boolean) ?? false,
      booking_status: existing?.booking_status ?? 'to_book',
      booking_deadline: existing?.booking_deadline ?? '',
      linked_booking_id: existing?.linked_booking_id ?? '',
      links: existing ? existingLinks.map((l) => ({ id: l.id, label: l.label ?? '', url: l.url })) : ((defaults?.links as { label: string; url: string }[]) ?? []),
      attention: { ...(existing?.attention_notes ?? (defaults?.attention_notes as Record<string, string>) ?? {}) } as Record<string, string>,
      notes: existing?.notes ?? '',
    },
  })
  const linkFields = useFieldArray({ control: form.control, name: 'links' })
  const needsBooking = form.watch('needs_booking')
  const bookingStatus = form.watch('booking_status')
  const errors = form.formState.errors
  const days = useMemo(() => tripDays(trip.start_date, trip.end_date), [trip.start_date, trip.end_date])
  const dayValue = form.watch('day_date')
  const near = trip.lat != null && trip.lng != null ? { lat: trip.lat, lng: trip.lng } : null

  const submit = async (v: Values) => {
    try {
      // lieu
      let place_id: string | null = null
      if (place?.kind === 'existing') place_id = place.place.id
      if (place?.kind === 'new') {
        const reuse = (places.data ?? []).find((p) => p.osm_id && p.osm_id === place.geo.osm_id)
        if (reuse) place_id = reuse.id
        else {
          const p = await writer.insert('places', {
            trip_id: trip.id, name: place.geo.name, address: place.geo.label || null,
            lat: place.geo.lat, lng: place.geo.lng, osm_id: place.geo.osm_id,
          })
          place_id = p.id
        }
      }
      const attention: AttentionNotes = {}
      for (const [k, val] of Object.entries(v.attention)) if (val?.trim()) attention[k as keyof AttentionNotes] = val.trim()
      const day = v.day_date || null
      const sameDay = (activities.data ?? []).filter((a) => a.day_date === day && a.id !== id)
      const row: Partial<Activity> = {
        trip_id: trip.id,
        title: v.title,
        description: v.description || null,
        category: v.category as ActivityCategory,
        day_date: day,
        start_time: v.start_time || null,
        end_time: v.end_time || null,
        duration_min: v.duration_min ? Number(v.duration_min) : null,
        est_cost: v.est_cost ? Number(v.est_cost.replace(',', '.')) : null,
        currency: v.currency,
        needs_booking: v.needs_booking,
        booking_status: v.needs_booking ? v.booking_status : null,
        booking_deadline: v.needs_booking && v.booking_deadline ? v.booking_deadline : null,
        linked_booking_id: v.needs_booking && v.linked_booking_id ? v.linked_booking_id : null,
        attention_notes: attention,
        notes: v.notes || null,
        place_id,
      }
      let activityId = id
      if (existing) {
        if (existing.day_date !== day) row.sort_order = Math.max(0, ...sameDay.map((a) => a.sort_order)) + 1000
        await writer.update('activities', existing.id, row)
      } else {
        row.sort_order = Math.max(0, ...sameDay.map((a) => a.sort_order)) + 1000
        activityId = (await writer.insert('activities', { ...row, id: uid() })).id
      }
      // liens
      const keep = v.links.filter((l) => l.url.trim())
      const keptIds = new Set(keep.map((l) => l.id).filter(Boolean))
      await Promise.all(existingLinks.filter((l) => !keptIds.has(l.id)).map((l) => writer.remove('activity_links', l.id)))
      const toInsert = keep.filter((l) => !l.id).map((l) => ({ trip_id: trip.id, activity_id: activityId!, label: l.label || null, url: safeUrl(l.url)! }))
      if (toInsert.length) await writer.insertMany('activity_links', toInsert)
      await Promise.all(
        keep.filter((l) => l.id).map((l) => {
          const old = existingLinks.find((x) => x.id === l.id)
          return old && (old.url !== l.url || (old.label ?? '') !== (l.label ?? ''))
            ? writer.update('activity_links', l.id!, { url: safeUrl(l.url)!, label: l.label || null })
            : null
        }),
      )
      // participants concernés
      const current = (attendees.data ?? []).filter((a) => a.activity_id === activityId)
      const currentIds = new Set(current.map((a) => a.member_id))
      await Promise.all(current.filter((a) => !attendeeIds.includes(a.member_id)).map((a) => writer.remove('activity_attendees', a.id)))
      const add = attendeeIds.filter((m) => !currentIds.has(m)).map((m) => ({ trip_id: trip.id, activity_id: activityId!, member_id: m }))
      if (add.length) await writer.insertMany('activity_attendees', add)
      toast.success(existing ? 'Activité mise à jour' : day ? `Ajoutée au ${fmtDay(day)}` : 'Idée ajoutée à la liste')
      onClose()
    } catch {
      /* erreur déjà affichée */
    }
  }

  const remove = async () => {
    if (!existing) return
    if (!(await confirm({ title: `Supprimer « ${existing.title} » ?`, confirmLabel: 'Supprimer', destructive: true }))) return
    await writer.remove('activities', existing.id)
    toast.success('Activité supprimée')
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent wide>
        <form onSubmit={form.handleSubmit(submit)} className="flex min-h-0 flex-1 flex-col" noValidate>
          <DialogHeader>
            <DialogTitle>{existing ? 'Modifier l’activité' : 'Nouvelle activité'}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Field label="Titre" htmlFor="act-title" error={errors.title?.message}>
              <Input id="act-title" placeholder="Visite de l’Alhambra" autoFocus={!existing} aria-invalid={!!errors.title} {...form.register('title')} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Jour" htmlFor="act-day">
                <NativeSelect id="act-day" {...form.register('day_date')}>
                  <option value="">💡 Idée non planifiée</option>
                  {days.map((d) => <option key={d} value={d}>{fmtDay(d)}</option>)}
                  {dayValue && !days.includes(dayValue) && <option value={dayValue}>{fmtDay(dayValue)}</option>}
                </NativeSelect>
              </Field>
              <Field label="Catégorie" htmlFor="act-cat">
                <NativeSelect id="act-cat" {...form.register('category')}>
                  {Object.entries(ACTIVITY_CATEGORIES).map(([k, c]) => <option key={k} value={k}>{c.emoji} {c.label}</option>)}
                </NativeSelect>
              </Field>
            </div>
            {!days.length && (
              <Field label="Date" htmlFor="act-date" hint="Le voyage n’a pas encore de dates : tu peux en choisir une librement.">
                <Input id="act-date" type="date" {...form.register('day_date')} />
              </Field>
            )}
            <div className="grid grid-cols-3 gap-3">
              <Field label="Début" htmlFor="act-start"><Input id="act-start" type="time" {...form.register('start_time')} /></Field>
              <Field label="Fin" htmlFor="act-end" error={errors.end_time?.message}><Input id="act-end" type="time" {...form.register('end_time')} /></Field>
              <Field label="Durée (min)" htmlFor="act-dur"><Input id="act-dur" type="number" min={0} step={15} inputMode="numeric" {...form.register('duration_min')} /></Field>
            </div>

            <Field label="Lieu" htmlFor="act-place">
              {place ? (
                <div className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2">
                  <MapPin className="h-4 w-4 shrink-0 text-coral" />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="truncate font-semibold">{place.kind === 'existing' ? place.place.name : place.geo.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{place.kind === 'existing' ? place.place.address : place.geo.label}</p>
                  </div>
                  <Button variant="ghost" size="icon-sm" aria-label="Retirer le lieu" onClick={() => setPlace(null)}><X /></Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <PlaceSearch id="act-place" near={near} onSelect={(geo) => setPlace({ kind: 'new', geo })} placeholder="Musée, restaurant, adresse…" />
                  {!!places.data?.length && (
                    <div className="flex flex-wrap gap-1.5">
                      {places.data.slice(0, 8).map((p) => (
                        <button key={p.id} type="button" onClick={() => setPlace({ kind: 'existing', place: p })}
                          className="rounded-full border bg-card px-2.5 py-1 text-xs hover:bg-accent">📍 {p.name}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Field>

            <Field label="Description" htmlFor="act-desc">
              <Textarea id="act-desc" rows={2} placeholder="Ce qu’on va y faire, pourquoi c’est chouette…" {...form.register('description')} />
            </Field>

            {/* À réserver */}
            <div className={cn('rounded-2xl border p-3 transition-colors', needsBooking && 'border-warning/60 bg-warning/5')}>
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="act-needs" className="flex items-center gap-2 text-sm font-semibold">
                  <AlertTriangle className="h-4 w-4 text-warning" /> À réserver
                </label>
                <Controller control={form.control} name="needs_booking" render={({ field }) => (
                  <Switch id="act-needs" checked={field.value} onCheckedChange={field.onChange} />
                )} />
              </div>
              {needsBooking && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Statut" htmlFor="act-bstatus">
                    <NativeSelect id="act-bstatus" {...form.register('booking_status')}>
                      <option value="to_book">⏳ À réserver</option>
                      <option value="booked">✅ Réservé</option>
                    </NativeSelect>
                  </Field>
                  <Field label="Réserver avant le" htmlFor="act-deadline" hint="Une alerte s’affiche à l’approche.">
                    <Input id="act-deadline" type="date" {...form.register('booking_deadline')} />
                  </Field>
                  {bookingStatus === 'booked' && !!bookings.data?.length && (
                    <Field label="Réservation liée" htmlFor="act-linked" className="sm:col-span-2">
                      <NativeSelect id="act-linked" {...form.register('linked_booking_id')}>
                        <option value="">— Aucune —</option>
                        {bookings.data.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
                      </NativeSelect>
                    </Field>
                  )}
                </div>
              )}
            </div>

            {/* Points d'attention */}
            <section>
              <button type="button" className="flex w-full items-center justify-between py-1 text-sm font-semibold" onClick={() => setShowAttention((s) => !s)} aria-expanded={showAttention}>
                <span>⚠️ Points d’attention <span className="font-normal text-muted-foreground">(horaires, fermeture, matériel…)</span></span>
                <ChevronDown className={cn('h-4 w-4 transition-transform', showAttention && 'rotate-180')} />
              </button>
              {showAttention && (
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {ATTENTION_FIELDS.map((f) => (
                    <Field key={f.key} label={`${f.emoji} ${f.label}`} htmlFor={`att-${f.key}`}>
                      <Input id={`att-${f.key}`} placeholder={f.placeholder} {...form.register(`attention.${f.key}`)} />
                    </Field>
                  ))}
                </div>
              )}
            </section>

            <section>
              <button type="button" className="flex w-full items-center justify-between py-1 text-sm font-semibold" onClick={() => setShowMore((s) => !s)} aria-expanded={showMore}>
                <span>Plus de détails <span className="font-normal text-muted-foreground">(coût, liens, participants, notes)</span></span>
                <ChevronDown className={cn('h-4 w-4 transition-transform', showMore && 'rotate-180')} />
              </button>
              {showMore && (
                <div className="mt-2 space-y-4">
                  <div className="grid grid-cols-[1fr_7rem] gap-3">
                    <Field label="Coût estimé (total)" htmlFor="act-cost" error={errors.est_cost?.message}>
                      <Input id="act-cost" inputMode="decimal" placeholder="0" {...form.register('est_cost')} />
                    </Field>
                    <Field label="Devise" htmlFor="act-cur">
                      <NativeSelect id="act-cur" {...form.register('currency')}>
                        {CURRENCY_CODES.map((c) => <option key={c}>{c}</option>)}
                      </NativeSelect>
                    </Field>
                  </div>
                  <div className="space-y-2">
                    <span className="text-sm font-semibold">Liens</span>
                    {linkFields.fields.map((f, i) => (
                      <div key={f.id} className="flex gap-2">
                        <Input className="w-28 shrink-0" placeholder="Billetterie" aria-label="Libellé du lien" {...form.register(`links.${i}.label`)} />
                        <Input placeholder="https://…" type="url" inputMode="url" aria-label="Adresse du lien" aria-invalid={!!errors.links?.[i]?.url} {...form.register(`links.${i}.url`)} />
                        <Button variant="ghost" size="icon" aria-label="Supprimer le lien" onClick={() => linkFields.remove(i)}><Trash2 /></Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => linkFields.append({ label: '', url: '' })}><Link2 /> Ajouter un lien</Button>
                  </div>
                  <div className="space-y-2">
                    <span className="text-sm font-semibold">Participants concernés</span>
                    <MemberPicker members={members} value={attendeeIds} onChange={setAttendeeIds} />
                  </div>
                  <Field label="Notes" htmlFor="act-notes">
                    <Textarea id="act-notes" rows={2} {...form.register('notes')} />
                  </Field>
                </div>
              )}
            </section>
          </DialogBody>
          <DialogFooter>
            {existing && <Button variant="ghost" className="text-destructive sm:mr-auto" onClick={remove}><Trash2 /> Supprimer</Button>}
            <Button variant="ghost" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : !existing && <Plus />}
              {existing ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
