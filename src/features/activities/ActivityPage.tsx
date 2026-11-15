import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, CheckCircle2, Clock, ExternalLink, MapPin, Pencil, ThumbsUp, Ticket, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { useTrip } from '@/features/trips/TripContext'
import { useQuickAdd } from '@/features/trips/QuickAdd'
import { useTripTable } from '@/lib/data'
import { ACTIVITY_CATEGORIES, ATTENTION_FIELDS } from '@/lib/constants'
import { fmtDayLong, fmtMoney, fmtTime, fmtDay } from '@/lib/format'
import { hostname } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import { DeadlineBadge } from '@/components/DeadlineBadge'
import { UpdatedBy } from '@/components/UpdatedBy'
import { Comments } from '@/components/Comments'
import { Attachments } from '@/components/Attachments'
import { MapLinks } from '@/components/MapLinks'
import { useActivityData } from './useActivityData'

export default function ActivityPage() {
  const { activityId = '' } = useParams()
  const navigate = useNavigate()
  const { trip, canEdit, writer, members } = useTrip()
  const quick = useQuickAdd()
  const data = useActivityData()
  const links = useTripTable(trip.id, 'activity_links')
  const bookings = useTripTable(trip.id, 'bookings')
  const a = data.activities.find((x) => x.id === activityId)

  if (!a) {
    return data.loading ? null : (
      <EmptyState icon={CalendarDays} title="Activité introuvable" description="Elle a peut-être été supprimée."
        action={<Button asChild><Link to={`/t/${trip.id}/planning`}>Retour au planning</Link></Button>} />
    )
  }
  const cat = ACTIVITY_CATEGORIES[a.category] ?? ACTIVITY_CATEGORIES.other
  const place = a.place_id ? data.placeById[a.place_id] : undefined
  const myLinks = (links.data ?? []).filter((l) => l.activity_id === a.id)
  const attention = ATTENTION_FIELDS.filter((f) => a.attention_notes?.[f.key])
  const linked = a.linked_booking_id ? bookings.data?.find((b) => b.id === a.linked_booking_id) : undefined
  const attendees = data.attendeesOf[a.id] ?? []
  const vote = data.votesOf[a.id]

  const markBooked = async () => {
    await writer.update('activities', a.id, { booking_status: 'booked' })
    toast.success('Marqué comme réservé ✅', {
      action: { label: 'Créer la réservation', onClick: () => quick({ kind: 'booking', defaults: { fromActivity: a.id } }) },
    })
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" className="-ml-2" onClick={() => (history.length > 1 ? navigate(-1) : navigate(`/t/${trip.id}/planning`))}><ArrowLeft /> Retour</Button>
      <div className="flex items-start gap-3">
        <span className="text-4xl" aria-hidden>{cat.emoji}</span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{a.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">{cat.label}</Badge>
            <span className="flex items-center gap-1 first-letter:uppercase"><CalendarDays className="h-4 w-4" />{a.day_date ? fmtDayLong(a.day_date) : 'Idée non planifiée'}</span>
            {a.start_time && <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{fmtTime(a.start_time)}{a.end_time && ` – ${fmtTime(a.end_time)}`}</span>}
          </div>
          <UpdatedBy row={a} className="mt-1 block" />
        </div>
        {canEdit && <Button variant="outline" size="icon" aria-label="Modifier" onClick={() => quick({ kind: 'activity', id: a.id })}><Pencil /></Button>}
      </div>

      {a.needs_booking && (
        <Card className={a.booking_status === 'booked' ? 'border-success/40' : 'border-warning/60 bg-warning/5'}>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="space-y-1">
              <DeadlineBadge deadline={a.booking_deadline ?? a.day_date} booked={a.booking_status === 'booked'} />
              {a.booking_deadline && a.booking_status !== 'booked' && <p className="text-sm">À réserver avant le <strong>{fmtDay(a.booking_deadline)}</strong></p>}
              {linked && (
                <Link to={`/t/${trip.id}/bookings/${linked.id}`} className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline"><Ticket className="h-4 w-4" /> {linked.title}</Link>
              )}
            </div>
            {canEdit && a.booking_status !== 'booked' && <Button onClick={markBooked}><CheckCircle2 /> Marquer réservé</Button>}
            {canEdit && a.booking_status === 'booked' && !linked && (
              <Button variant="outline" onClick={() => quick({ kind: 'booking', defaults: { fromActivity: a.id } })}><Ticket /> Ajouter la réservation</Button>
            )}
          </CardContent>
        </Card>
      )}

      {a.description && <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{a.description}</p>}

      {attention.length > 0 && (
        <Card>
          <CardHeader><CardTitle>⚠️ Points d’attention</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-2">
              {attention.map((f) => (
                <div key={f.key} className="rounded-xl bg-muted/60 p-3">
                  <dt className="text-xs font-semibold text-muted-foreground">{f.emoji} {f.label}</dt>
                  <dd className="mt-0.5 text-sm">{a.attention_notes[f.key]}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}

      {place && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-5 w-5 text-coral" />
              <div>
                <p className="font-semibold">{place.name}</p>
                {place.address && <p className="text-sm text-muted-foreground">{place.address}</p>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <MapLinks lat={place.lat} lng={place.lng} name={place.name} />
              <Button asChild variant="ghost" size="sm"><Link to={`/t/${trip.id}/map?focus=${place.id}`}><MapPin /> Voir sur la carte</Link></Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {(a.est_cost != null || canEdit) && (
          <Card>
            <CardContent className="flex items-center justify-between gap-2 p-4">
              <div>
                <p className="text-xs text-muted-foreground">Coût estimé</p>
                <p className="text-lg font-bold">{a.est_cost != null ? fmtMoney(a.est_cost, a.currency ?? trip.currency) : '—'}</p>
              </div>
              {canEdit && (
                <Button variant="outline" size="sm" onClick={() => quick({ kind: 'expense', defaults: { title: a.title, amount: a.est_cost, currency: a.currency, activity_id: a.id, category: 'activities' } })}>
                  <Wallet /> Dépense
                </Button>
              )}
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="flex items-center justify-between gap-2 p-4">
            <div>
              <p className="text-xs text-muted-foreground">Participants</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {(attendees.length ? attendees : members).map((m) => <Avatar key={m.id} name={m.display_name} color={m.color} size="xs" />)}
              </div>
            </div>
            <Button variant={vote?.mine ? 'coral' : 'outline'} size="sm" onClick={() => data.toggleVote(a.id)} aria-pressed={!!vote?.mine}>
              <ThumbsUp /> {vote?.count ?? 0}
            </Button>
          </CardContent>
        </Card>
      </div>

      {myLinks.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Liens</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2">
            {myLinks.map((l) => (
              <a key={l.id} href={l.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-accent">
                <ExternalLink className="h-4 w-4 shrink-0 text-primary" />
                <span className="font-semibold">{l.label || hostname(l.url)}</span>
                {l.label && <span className="truncate text-xs text-muted-foreground">{hostname(l.url)}</span>}
              </a>
            ))}
          </CardContent>
        </Card>
      )}

      {a.notes && (
        <Card><CardHeader><CardTitle>Notes</CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap text-sm">{a.notes}</p></CardContent></Card>
      )}

      <Card>
        <CardHeader><CardTitle>Pièces jointes</CardTitle></CardHeader>
        <CardContent><Attachments parentType="activity" parentId={a.id} /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Commentaires</CardTitle></CardHeader>
        <CardContent><Comments parentType="activity" parentId={a.id} /></CardContent>
      </Card>
    </div>
  )
}
