import { Link, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { MapPin, X } from 'lucide-react'
import { useTrip } from '@/features/trips/TripContext'
import { useTripTable } from '@/lib/data'
import { BOOKING_TYPES } from '@/lib/constants'
import { fmtDateTime } from '@/lib/format'
import { useWakeLock } from '@/lib/hooks'
import { Attachments } from '@/components/Attachments'

/** Vue plein écran, très lisible, à montrer au guichet (l'écran reste allumé) */
export default function TicketPage() {
  const { bookingId = '' } = useParams()
  const { trip, memberById } = useTrip()
  const bookings = useTripTable(trip.id, 'bookings')
  const places = useTripTable(trip.id, 'places')
  const attendees = useTripTable(trip.id, 'booking_attendees')
  useWakeLock(true)
  const b = bookings.data?.find((x) => x.id === bookingId)
  if (!b) return null
  const place = b.place_id ? places.data?.find((p) => p.id === b.place_id) : undefined
  const names = (attendees.data ?? []).filter((a) => a.booking_id === b.id).map((a) => memberById[a.member_id]?.display_name).filter(Boolean)
  return (
    <div className="min-h-dvh bg-white text-neutral-900">
      <div className="mx-auto flex max-w-lg flex-col gap-5 p-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-neutral-500">{BOOKING_TYPES[b.type].emoji} {BOOKING_TYPES[b.type].label} · {trip.name}</p>
            <h1 className="mt-1 font-display text-3xl font-bold leading-tight">{b.title}</h1>
          </div>
          <Link to=".." relative="path" className="rounded-full bg-neutral-100 p-3" aria-label="Fermer le billet"><X className="h-6 w-6" /></Link>
        </div>
        {b.confirmation_code && (
          <div className="rounded-3xl border-4 border-dashed border-neutral-300 p-5 text-center">
            <p className="text-sm font-semibold text-neutral-500">Numéro de confirmation</p>
            <p className="mt-1 break-all font-mono text-5xl font-black tracking-[0.15em]">{b.confirmation_code}</p>
            <div className="mt-4 flex justify-center"><QRCodeSVG value={b.confirmation_code} size={140} /></div>
          </div>
        )}
        <div className="space-y-1 text-lg first-letter:uppercase">
          {b.start_at && <p>🕘 <strong>{fmtDateTime(b.start_at)}</strong></p>}
          {b.end_at && <p className="text-neutral-600">jusqu’au {fmtDateTime(b.end_at)}</p>}
          {place && <p className="flex items-start gap-1"><MapPin className="mt-1 h-5 w-5" />{place.name}{place.address ? `, ${place.address}` : ''}</p>}
          {names.length > 0 && <p>👥 {names.join(', ')}</p>}
        </div>
        {b.notes && <p className="whitespace-pre-wrap rounded-2xl bg-neutral-100 p-4">{b.notes}</p>}
        <div className="[&_*]:!text-neutral-900">
          <Attachments parentType="booking" parentId={b.id} large />
        </div>
        <p className="text-center text-xs text-neutral-400">Astuce : monte la luminosité de l’écran. L’écran reste allumé sur cette page.</p>
      </div>
    </div>
  )
}
