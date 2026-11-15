import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, Check, Copy, ExternalLink, Maximize2, Pencil, Ticket, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { useTrip } from '@/features/trips/TripContext'
import { useQuickAdd } from '@/features/trips/QuickAdd'
import { useTripTable } from '@/lib/data'
import { BOOKING_STATUS, BOOKING_TYPES } from '@/lib/constants'
import { fmtDateTime, fmtMoney } from '@/lib/format'
import { hostname } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import { NativeSelect } from '@/components/ui/input'
import { Attachments } from '@/components/Attachments'
import { Comments } from '@/components/Comments'
import { MapLinks } from '@/components/MapLinks'
import { UpdatedBy } from '@/components/UpdatedBy'
import type { BookingStatus } from '@/lib/types'

export default function BookingPage() {
  const { bookingId = '' } = useParams()
  const navigate = useNavigate()
  const { trip, canEdit, writer, memberById } = useTrip()
  const quick = useQuickAdd()
  const bookings = useTripTable(trip.id, 'bookings')
  const places = useTripTable(trip.id, 'places')
  const expenses = useTripTable(trip.id, 'expenses')
  const activities = useTripTable(trip.id, 'activities')
  const attendees = useTripTable(trip.id, 'booking_attendees')
  const b = bookings.data?.find((x) => x.id === bookingId)
  if (!b) {
    return bookings.isLoading ? null : (
      <EmptyState icon={Ticket} title="Réservation introuvable" action={<Button asChild><Link to={`/t/${trip.id}/bookings`}>Réservations</Link></Button>} />
    )
  }
  const t = BOOKING_TYPES[b.type]
  const place = b.place_id ? places.data?.find((p) => p.id === b.place_id) : undefined
  const linkedExpenses = (expenses.data ?? []).filter((e) => e.booking_id === b.id)
  const linkedActivities = (activities.data ?? []).filter((a) => a.linked_booking_id === b.id)
  const who = (attendees.data ?? []).filter((a) => a.booking_id === b.id).map((a) => memberById[a.member_id]).filter(Boolean)

  const copy = async () => {
    if (!b.confirmation_code) return
    await navigator.clipboard.writeText(b.confirmation_code)
    toast.success('Numéro copié')
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Button variant="ghost" className="-ml-2" onClick={() => (history.length > 1 ? navigate(-1) : navigate(`/t/${trip.id}/bookings`))}><ArrowLeft /> Retour</Button>
      <div className="flex items-start gap-3">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl" style={{ backgroundColor: `${t.color}22` }} aria-hidden>{t.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.label}</p>
          <h1 className="text-2xl font-bold leading-tight">{b.title}</h1>
          <UpdatedBy row={b} className="block" />
        </div>
        {canEdit && <Button variant="outline" size="icon" aria-label="Modifier" onClick={() => quick({ kind: 'booking', id: b.id })}><Pencil /></Button>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {canEdit ? (
          <NativeSelect aria-label="Statut" className="w-44" value={b.status} onChange={(e) => writer.update('bookings', b.id, { status: e.target.value as BookingStatus })}>
            {Object.entries(BOOKING_STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
          </NativeSelect>
        ) : (
          <Badge variant={BOOKING_STATUS[b.status].variant}>{BOOKING_STATUS[b.status].label}</Badge>
        )}
        {canEdit && b.status === 'to_book' && <Button size="sm" onClick={() => writer.update('bookings', b.id, { status: 'booked' })}><Check /> Réservé</Button>}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="space-y-4">
      {(b.confirmation_code || b.start_at) && (
        <Card className="overflow-hidden">
          <CardContent className="space-y-3 p-4">
            {b.confirmation_code && (
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">N° de confirmation</p>
                  <p className="font-mono text-2xl font-bold tracking-widest">{b.confirmation_code}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={copy} aria-label="Copier le numéro"><Copy /></Button>
              </div>
            )}
            {b.start_at && (
              <div className="flex items-start gap-2 text-sm">
                <CalendarDays className="mt-0.5 h-4 w-4 text-primary" />
                <div className="first-letter:uppercase">
                  <p><strong>Début</strong> : {fmtDateTime(b.start_at)}</p>
                  {b.end_at && <p><strong>Fin</strong> : {fmtDateTime(b.end_at)}</p>}
                </div>
              </div>
            )}
            <Button asChild className="w-full" variant="coral">
              <Link to="ticket"><Maximize2 /> Mode billet (plein écran)</Link>
            </Button>
          </CardContent>
        </Card>
      )}
      {b.notes && <Card><CardHeader><CardTitle>Notes</CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap text-sm">{b.notes}</p></CardContent></Card>}
      <Card>
        <CardHeader><CardTitle>Billets et documents</CardTitle></CardHeader>
        <CardContent><Attachments parentType="booking" parentId={b.id} /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Commentaires</CardTitle></CardHeader>
        <CardContent><Comments parentType="booking" parentId={b.id} /></CardContent>
      </Card>
        </div>
        <div className="space-y-4">
      {place && (
        <Card>
          <CardContent className="space-y-2 p-4">
            <p className="font-semibold">📍 {place.name}</p>
            {place.address && <p className="text-sm text-muted-foreground">{place.address}</p>}
            <MapLinks lat={place.lat} lng={place.lng} name={place.name} />
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <Card>
          <CardContent className="space-y-2 p-4">
            <p className="text-xs text-muted-foreground">Prix</p>
            <p className="text-xl font-bold">{b.price != null ? fmtMoney(b.price, b.currency ?? trip.currency) : '—'}</p>
            {linkedExpenses.map((e) => (
              <Link key={e.id} to={`/t/${trip.id}/budget?expense=${e.id}`} className="flex items-center gap-1 text-sm font-semibold text-success hover:underline">
                <Wallet className="h-4 w-4" /> Dépense : {fmtMoney(e.amount_main, trip.currency)} payée par {memberById[e.paid_by]?.display_name ?? '?'}
              </Link>
            ))}
            {canEdit && b.price != null && !linkedExpenses.length && (
              <Button size="sm" variant="outline" onClick={() => quick({ kind: 'expense', defaults: { title: b.title, amount: b.price, currency: b.currency, booking_id: b.id, category: t.budget, members: who.map((m) => m.id) } })}>
                <Wallet /> Créer la dépense
              </Button>
            )}
          </CardContent>
        </Card>
        {who.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <p className="mb-2 text-xs text-muted-foreground">Concerne</p>
              <div className="flex flex-wrap gap-2">
                {who.map((m) => <span key={m.id} className="flex items-center gap-1.5 rounded-full bg-muted py-0.5 pl-0.5 pr-2.5 text-xs font-semibold"><Avatar name={m.display_name} color={m.color} size="xs" className="ring-0" />{m.display_name}</span>)}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      {linkedActivities.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Activités liées</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-1">
            {linkedActivities.map((a) => <Link key={a.id} to={`/t/${trip.id}/activities/${a.id}`} className="text-sm font-semibold text-primary hover:underline">→ {a.title}</Link>)}
          </CardContent>
        </Card>
      )}
      {b.url && (
        <Button asChild variant="outline" className="w-full justify-start"><a href={b.url} target="_blank" rel="noreferrer"><ExternalLink /> {hostname(b.url)}</a></Button>
      )}
        </div>
      </div>





    </div>
  )
}
