import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import { useTrip } from './TripContext'
import { useTripTable } from '@/lib/data'
import { tripDays } from '@/lib/dates'
import { fmtDateRange, fmtDateTime, fmtDayLong, fmtTime, fmtDay } from '@/lib/format'
import { ACTIVITY_CATEGORIES, BOOKING_TYPES, BOOKING_STATUS } from '@/lib/constants'
import { indexBy } from '@/lib/utils'
import { buildTodo, sortDay } from '@/features/activities/logic'
import { Button } from '@/components/ui/button'

/** Programme imprimable : « Imprimer » → « Enregistrer en PDF » dans le navigateur */
export default function PrintPage() {
  const { trip, members } = useTrip()
  const activities = useTripTable(trip.id, 'activities')
  const bookings = useTripTable(trip.id, 'bookings')
  const places = useTripTable(trip.id, 'places')
  const placeById = indexBy(places.data)
  const days = useMemo(() => {
    const s = new Set(tripDays(trip.start_date, trip.end_date))
    for (const a of activities.data ?? []) if (a.day_date) s.add(a.day_date)
    return [...s].sort()
  }, [activities.data, trip.start_date, trip.end_date])
  const todo = buildTodo(activities.data ?? [], bookings.data ?? [])
  const ideas = (activities.data ?? []).filter((a) => !a.day_date)

  return (
    <div className="mx-auto max-w-3xl bg-white p-2 text-neutral-900 print:p-0">
      <div className="no-print mb-4 flex justify-between gap-2">
        <Button asChild variant="ghost"><Link to={`/t/${trip.id}`}><ArrowLeft /> Retour</Link></Button>
        <Button onClick={() => window.print()}><Printer /> Imprimer / PDF</Button>
      </div>
      <header className="border-b-2 border-neutral-800 pb-3">
        <h1 className="font-display text-3xl font-bold">{trip.name}</h1>
        <p className="text-sm">{[trip.destination, fmtDateRange(trip.start_date, trip.end_date)].filter(Boolean).join(' · ')}</p>
        <p className="text-xs text-neutral-600">Participants : {members.map((m) => m.display_name).join(', ')}</p>
      </header>

      {todo.length > 0 && (
        <section className="mt-5 break-inside-avoid">
          <h2 className="text-lg font-bold">⚠️ Reste à réserver</h2>
          <ul className="mt-1 list-disc pl-5 text-sm">
            {todo.map((t) => <li key={t.id}>{t.title}{t.deadline ? ` — avant le ${fmtDay(t.deadline)}` : ''}</li>)}
          </ul>
        </section>
      )}

      {(bookings.data ?? []).length > 0 && (
        <section className="mt-5">
          <h2 className="text-lg font-bold">🎫 Réservations</h2>
          <table className="mt-1 w-full text-left text-sm">
            <tbody>
              {[...(bookings.data ?? [])].sort((a, b) => (a.start_at ?? '9').localeCompare(b.start_at ?? '9')).map((b) => (
                <tr key={b.id} className="border-b border-neutral-200 align-top">
                  <td className="py-1 pr-2">{BOOKING_TYPES[b.type].emoji}</td>
                  <td className="py-1 pr-2"><strong>{b.title}</strong>{b.place_id && placeById[b.place_id] ? <><br /><span className="text-xs">{placeById[b.place_id].name}</span></> : null}</td>
                  <td className="py-1 pr-2 text-xs">{b.start_at ? fmtDateTime(b.start_at) : '—'}</td>
                  <td className="py-1 pr-2 font-mono text-xs font-bold">{b.confirmation_code ?? ''}</td>
                  <td className="py-1 text-xs">{BOOKING_STATUS[b.status].label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {days.map((d, i) => {
        const list = sortDay((activities.data ?? []).filter((a) => a.day_date === d))
        return (
          <section key={d} className="mt-5 break-inside-avoid">
            <h2 className="text-lg font-bold first-letter:uppercase">Jour {i + 1} — {fmtDayLong(d)}</h2>
            {list.length ? (
              <ul className="mt-1 space-y-1.5 text-sm">
                {list.map((a) => (
                  <li key={a.id} className="border-l-4 border-neutral-300 pl-2">
                    <strong>{a.start_time ? `${fmtTime(a.start_time)} · ` : ''}{ACTIVITY_CATEGORIES[a.category]?.emoji} {a.title}</strong>
                    {a.place_id && placeById[a.place_id] && <span className="text-xs"> — {placeById[a.place_id].name}{placeById[a.place_id].address ? `, ${placeById[a.place_id].address}` : ''}</span>}
                    {a.description && <p className="text-xs text-neutral-700">{a.description}</p>}
                    {Object.values(a.attention_notes ?? {}).some(Boolean) && (
                      <p className="text-xs text-neutral-700">⚠️ {Object.values(a.attention_notes).filter(Boolean).join(' · ')}</p>
                    )}
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm italic text-neutral-500">Journée libre</p>}
          </section>
        )
      })}

      {ideas.length > 0 && (
        <section className="mt-5 break-inside-avoid">
          <h2 className="text-lg font-bold">💡 Idées en réserve</h2>
          <p className="text-sm">{ideas.map((a) => a.title).join(' · ')}</p>
        </section>
      )}
      {trip.notes && (
        <section className="mt-5 break-inside-avoid">
          <h2 className="text-lg font-bold">📝 Infos utiles</h2>
          <p className="whitespace-pre-wrap text-sm">{trip.notes}</p>
        </section>
      )}
      <p className="mt-8 text-center text-[10px] text-neutral-400">Généré avec Vadrouille</p>
    </div>
  )
}
