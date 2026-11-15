import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Award, Check, ExternalLink, Loader2, MapPin, Pencil, Plus, Scale, Star, ThumbsUp, Ticket, Trash2, Trophy, X } from 'lucide-react'
import { toast } from 'sonner'
import { useTrip } from './TripContext'
import { useQuickAdd } from './QuickAdd'
import { useTripTable } from '@/lib/data'
import { CURRENCY_CODES } from '@/lib/currencies'
import { fmtMoney } from '@/lib/format'
import { hostname, safeUrl } from '@/lib/utils'
import type { GeoResult } from '@/lib/geocode'
import type { TripOption } from '@/lib/types'
import { PageTitle } from '@/components/PageTitle'
import { PlaceSearch } from '@/components/PlaceSearch'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { Input, NativeSelect, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { EmptyState } from '@/components/ui/empty-state'
import { useConfirm } from '@/components/ui/confirm'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

/** Comparateur d'options : hôtels, itinéraires, restos… côte à côte, puis vote du groupe */
export default function ComparePage() {
  const { trip, canEdit } = useTrip()
  const options = useTripTable(trip.id, 'options')
  const [editing, setEditing] = useState<{ option?: TripOption; group?: string } | null>(null)
  const groups = useMemo(() => {
    const g: Record<string, TripOption[]> = {}
    for (const o of [...(options.data ?? [])].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))) (g[o.group_name] ??= []).push(o)
    return Object.entries(g)
  }, [options.data])

  return (
    <div className="space-y-5">
      <PageTitle title="Comparer" subtitle="Plusieurs options ? Mettez-les côte à côte et votez."
        action={canEdit && <Button onClick={() => setEditing({})}><Plus /> Comparaison</Button>} />
      {!groups.length ? (
        <EmptyState icon={Scale} title="Rien à comparer pour l’instant" description="Ex. « Hôtel à Kyoto » avec 3 hôtels, ou « Comment aller à Sintra » avec train / voiture / excursion."
          action={canEdit && <Button onClick={() => setEditing({})}><Plus /> Créer une comparaison</Button>} />
      ) : (
        groups.map(([name, list]) => <CompareGroup key={name} name={name} options={list} onEdit={(o) => setEditing({ option: o })} onAdd={() => setEditing({ group: name })} />)
      )}
      {editing && <OptionDialog option={editing.option} group={editing.group} groups={groups.map(([g]) => g)} onClose={() => setEditing(null)} />}
    </div>
  )
}

function CompareGroup({ name, options, onEdit, onAdd }: { name: string; options: TripOption[]; onEdit: (o: TripOption) => void; onAdd: () => void }) {
  const { trip, canEdit, writer, me, memberById } = useTrip()
  const quick = useQuickAdd()
  const confirm = useConfirm()
  const votes = useTripTable(trip.id, 'option_votes')
  const places = useTripTable(trip.id, 'places')
  const votesOf = (id: string) => (votes.data ?? []).filter((v) => v.option_id === id)
  const priced = options.filter((o) => o.price != null && (o.currency ?? trip.currency) === (options[0]?.currency ?? trip.currency))
  const cheapest = priced.length > 1 ? priced.reduce((a, b) => (Number(a.price) <= Number(b.price) ? a : b)) : undefined
  const maxVotes = Math.max(0, ...options.map((o) => votesOf(o.id).length))
  const favourite = maxVotes > 0 && options.filter((o) => votesOf(o.id).length === maxVotes).length === 1 ? options.find((o) => votesOf(o.id).length === maxVotes) : undefined
  const chosen = options.find((o) => o.chosen)

  const toggleVote = async (o: TripOption) => {
    if (!me) return
    const mine = votesOf(o.id).find((v) => v.member_id === me.id)
    if (mine) await writer.remove('option_votes', mine.id)
    else await writer.insert('option_votes', { trip_id: trip.id, option_id: o.id, member_id: me.id })
  }
  const choose = async (o: TripOption) => {
    await Promise.all(options.filter((x) => x.chosen && x.id !== o.id).map((x) => writer.update('options', x.id, { chosen: false })))
    await writer.update('options', o.id, { chosen: !o.chosen })
    if (!o.chosen) toast.success(`« ${o.title} » choisi 🎉`, { action: !o.booking_id ? { label: 'Créer la réservation', onClick: () => book(o) } : undefined })
  }
  const book = (o: TripOption) => quick({ kind: 'booking', defaults: { title: o.title, price: o.price, currency: o.currency, url: o.url, notes: [o.pros && `+ ${o.pros}`, o.cons && `− ${o.cons}`, o.notes].filter(Boolean).join('\n'), status: 'to_book', place_id: o.place_id, fromOption: o.id, type: /h[oô]tel|logement|airbnb|appart/i.test(name) ? 'lodging' : /resto|d[iî]ner/i.test(name) ? 'restaurant' : /vol|avion/i.test(name) ? 'flight' : /train/i.test(name) ? 'train' : /voiture/i.test(name) ? 'car' : 'other' } })

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Scale className="h-5 w-5 text-primary" /> {name} {chosen && <Badge variant="success"><Check /> {chosen.title}</Badge>}</h2>
        {canEdit && (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={onAdd}><Plus /> Option</Button>
            <Button variant="ghost" size="icon-sm" aria-label={`Supprimer la comparaison ${name}`} onClick={async () => {
              if (await confirm({ title: `Supprimer « ${name} » et ses ${options.length} options ?`, destructive: true, confirmLabel: 'Supprimer' })) await Promise.all(options.map((o) => writer.remove('options', o.id)))
            }}><Trash2 /></Button>
          </div>
        )}
      </div>
      <div className="thin-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] lg:overflow-visible lg:px-0">
        {options.map((o) => {
          const vs = votesOf(o.id)
          const mine = !!me && vs.some((v) => v.member_id === me.id)
          const place = o.place_id ? places.data?.find((p) => p.id === o.place_id) : undefined
          return (
            <Card key={o.id} className={cn('flex w-72 shrink-0 snap-start flex-col gap-3 p-4 lg:w-auto', o.chosen && 'ring-2 ring-success')}>
              <div className="flex flex-wrap gap-1">
                {o.chosen && <Badge variant="success"><Trophy /> Choisi</Badge>}
                {favourite?.id === o.id && <Badge variant="coral"><Award /> Favori du groupe</Badge>}
                {cheapest?.id === o.id && <Badge>💸 Le moins cher</Badge>}
              </div>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-bold leading-snug">{o.title}</h3>
                {canEdit && <Button variant="ghost" size="icon-sm" aria-label={`Modifier ${o.title}`} onClick={() => onEdit(o)}><Pencil /></Button>}
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-extrabold tabular">{o.price != null ? fmtMoney(Number(o.price), o.currency ?? trip.currency) : '—'}</span>
                {o.rating != null && (
                  <span className="flex items-center gap-0.5 text-sm font-bold" aria-label={`Note ${o.rating} sur 5`}>
                    <Star className="h-4 w-4 fill-warning text-warning" /> {Number(o.rating).toLocaleString('fr-FR')}
                  </span>
                )}
              </div>
              {o.pros && <ul className="space-y-0.5 text-sm">{o.pros.split('\n').filter(Boolean).map((l, i) => <li key={i} className="flex gap-1.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />{l}</li>)}</ul>}
              {o.cons && <ul className="space-y-0.5 text-sm">{o.cons.split('\n').filter(Boolean).map((l, i) => <li key={i} className="flex gap-1.5"><X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />{l}</li>)}</ul>}
              {o.notes && <p className="whitespace-pre-wrap text-xs text-muted-foreground">{o.notes}</p>}
              {place && <Link to={`/t/${trip.id}/map?focus=${place.id}`} className="flex items-center gap-1 text-xs font-semibold text-primary"><MapPin className="h-3.5 w-3.5" />{place.name}</Link>}
              {o.url && <a href={o.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 truncate text-xs font-semibold text-primary"><ExternalLink className="h-3.5 w-3.5 shrink-0" />{hostname(o.url)}</a>}
              <div className="mt-auto space-y-2 border-t pt-3">
                <div className="flex items-center gap-2">
                  <Button size="sm" variant={mine ? 'coral' : 'outline'} onClick={() => toggleVote(o)} aria-pressed={mine}><ThumbsUp /> {vs.length}</Button>
                  <div className="flex -space-x-1.5">
                    {vs.slice(0, 5).map((v) => { const m = memberById[v.member_id]; return m ? <Avatar key={v.id} name={m.display_name} color={m.color} size="xs" /> : null })}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1" variant={o.chosen ? 'secondary' : 'default'} onClick={() => choose(o)}>{o.chosen ? 'Annuler le choix' : <><Check /> Choisir</>}</Button>
                    {o.booking_id ? (
                      <Button size="sm" variant="outline" asChild><Link to={`/t/${trip.id}/bookings/${o.booking_id}`}><Ticket /> Résa</Link></Button>
                    ) : o.chosen ? (
                      <Button size="sm" variant="outline" onClick={() => book(o)}><Ticket /> Réserver</Button>
                    ) : null}
                  </div>
                )}
              </div>
            </Card>
          )
        })}
      </div>
    </section>
  )
}

function OptionDialog({ option, group, groups, onClose }: { option?: TripOption; group?: string; groups: string[]; onClose: () => void }) {
  const { trip, writer } = useTrip()
  const places = useTripTable(trip.id, 'places')
  const confirm = useConfirm()
  const [g, setG] = useState(option?.group_name ?? group ?? '')
  const [title, setTitle] = useState(option?.title ?? '')
  const [price, setPrice] = useState(option?.price?.toString() ?? '')
  const [currency, setCurrency] = useState(option?.currency ?? trip.currency)
  const [rating, setRating] = useState(option?.rating?.toString() ?? '')
  const [url, setUrl] = useState(option?.url ?? '')
  const [pros, setPros] = useState(option?.pros ?? '')
  const [cons, setCons] = useState(option?.cons ?? '')
  const [notes, setNotes] = useState(option?.notes ?? '')
  const [geo, setGeo] = useState<GeoResult | null>(null)
  const [busy, setBusy] = useState(false)
  const near = trip.lat != null && trip.lng != null ? { lat: trip.lat, lng: trip.lng } : null

  const save = async () => {
    if (!g.trim() || !title.trim()) return toast.error('Indique la comparaison et le nom de l’option')
    if (url && !safeUrl(url)) return toast.error('Lien invalide')
    setBusy(true)
    try {
      let place_id = option?.place_id ?? null
      if (geo) place_id = (await writer.insert('places', { trip_id: trip.id, name: geo.name, address: geo.label || null, lat: geo.lat, lng: geo.lng, osm_id: geo.osm_id })).id
      const row = {
        trip_id: trip.id, group_name: g.trim(), title: title.trim(), price: price ? Number(price.replace(',', '.')) : null, currency,
        rating: rating ? Math.min(5, Math.max(0, Number(rating.replace(',', '.')))) : null, url: url ? safeUrl(url)! : null,
        pros: pros.trim() || null, cons: cons.trim() || null, notes: notes.trim() || null, place_id,
      }
      if (option) await writer.update('options', option.id, row)
      else await writer.insert('options', { ...row, chosen: false, booking_id: null, sort_order: Date.now() / 1000 })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent wide>
        <DialogHeader><DialogTitle>{option ? 'Modifier l’option' : 'Nouvelle option'}</DialogTitle></DialogHeader>
        <DialogBody className="space-y-4">
          <Field label="Comparaison" htmlFor="op-group" hint="Ex. « Hôtel à Kyoto », « Aller à Sintra »">
            <Input id="op-group" list="op-groups" value={g} onChange={(e) => setG(e.target.value)} placeholder="Hôtel à Kyoto" />
            <datalist id="op-groups">{groups.map((x) => <option key={x} value={x} />)}</datalist>
          </Field>
          <Field label="Option" htmlFor="op-title"><Input id="op-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ryokan Sakura" autoFocus={!option} /></Field>
          <div className="grid grid-cols-[1fr_6.5rem_5.5rem] gap-3">
            <Field label="Prix" htmlFor="op-price"><Input id="op-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" /></Field>
            <Field label="Devise" htmlFor="op-cur"><NativeSelect id="op-cur" value={currency} onChange={(e) => setCurrency(e.target.value)}>{CURRENCY_CODES.map((c) => <option key={c}>{c}</option>)}</NativeSelect></Field>
            <Field label="Note /5" htmlFor="op-rating"><Input id="op-rating" inputMode="decimal" value={rating} onChange={(e) => setRating(e.target.value)} placeholder="4,5" /></Field>
          </div>
          <Field label="Lien" htmlFor="op-url"><Input id="op-url" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="👍 Points forts (un par ligne)" htmlFor="op-pros"><Textarea id="op-pros" rows={3} value={pros} onChange={(e) => setPros(e.target.value)} placeholder={'Petit-déjeuner inclus\nVue sur le jardin'} /></Field>
            <Field label="👎 Points faibles (un par ligne)" htmlFor="op-cons"><Textarea id="op-cons" rows={3} value={cons} onChange={(e) => setCons(e.target.value)} placeholder={'Loin du centre'} /></Field>
          </div>
          <Field label="Lieu (facultatif)" htmlFor="op-place">
            <PlaceSearch id="op-place" near={near} value={geo?.name ?? places.data?.find((p) => p.id === option?.place_id)?.name ?? ''} onSelect={setGeo} onClear={() => setGeo(null)} />
          </Field>
          <Field label="Notes" htmlFor="op-notes"><Textarea id="op-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </DialogBody>
        <DialogFooter>
          {option && <Button variant="ghost" className="text-destructive sm:mr-auto" onClick={async () => {
            if (await confirm({ title: `Supprimer « ${option.title} » ?`, destructive: true, confirmLabel: 'Supprimer' })) { await writer.remove('options', option.id); onClose() }
          }}><Trash2 /> Supprimer</Button>}
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={save} disabled={busy}>{busy && <Loader2 className="animate-spin" />} Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
