// Supabase Edge Function (Deno) — rappel e-mail avant les dates limites de réservation.
// Optionnelle. Déclenchée chaque matin par pg_cron (voir supabase/cron/deadline-reminders.sql).
//
// Secrets à définir côté Supabase (JAMAIS dans le repo) :
//   supabase secrets set RESEND_API_KEY=... CRON_SECRET=... APP_URL=https://<user>.github.io/vadrouille/ MAIL_FROM="Vadrouille <rappels@ton-domaine.fr>"
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement aux Edge Functions.
import { createClient } from 'npm:@supabase/supabase-js@2.46.1'

const DAYS_BEFORE = [3, 1, 0] // J-3, veille, jour J

interface Item { trip_id: string; title: string; deadline: string; kind: 'activité' | 'réservation'; id: string }

const isoIn = (n: number) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

Deno.serve(async (req) => {
  if (req.headers.get('authorization') !== `Bearer ${Deno.env.get('CRON_SECRET')}`) {
    return new Response('unauthorized', { status: 401 })
  }
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const dates = DAYS_BEFORE.map(isoIn)

  const [acts, books] = await Promise.all([
    sb.from('activities').select('id, trip_id, title, booking_deadline').eq('needs_booking', true).eq('booking_status', 'to_book').in('booking_deadline', dates),
    sb.from('bookings').select('id, trip_id, title, booking_deadline').eq('status', 'to_book').in('booking_deadline', dates),
  ])
  if (acts.error || books.error) return new Response(JSON.stringify(acts.error ?? books.error), { status: 500 })

  const items: Item[] = [
    ...(acts.data ?? []).map((a) => ({ id: a.id, trip_id: a.trip_id, title: a.title, deadline: a.booking_deadline, kind: 'activité' as const })),
    ...(books.data ?? []).map((b) => ({ id: b.id, trip_id: b.trip_id, title: b.title, deadline: b.booking_deadline, kind: 'réservation' as const })),
  ]
  if (!items.length) return Response.json({ sent: 0 })

  const tripIds = [...new Set(items.map((i) => i.trip_id))]
  const [{ data: trips }, { data: members }] = await Promise.all([
    sb.from('trips').select('id, name').in('id', tripIds),
    sb.from('trip_members').select('trip_id, user_id, role').in('trip_id', tripIds).not('user_id', 'is', null).neq('role', 'viewer'),
  ])

  // un e-mail récapitulatif par personne
  const perUser = new Map<string, Item[]>()
  for (const m of members ?? []) for (const it of items.filter((i) => i.trip_id === m.trip_id)) perUser.set(m.user_id!, [...(perUser.get(m.user_id!) ?? []), it])

  const appUrl = Deno.env.get('APP_URL') ?? ''
  let sent = 0
  for (const [userId, list] of perUser) {
    const { data } = await sb.auth.admin.getUserById(userId)
    const email = data.user?.email
    if (!email) continue
    const rows = list.map((it) => {
      const trip = trips?.find((t) => t.id === it.trip_id)
      const when = it.deadline === dates[2] ? "aujourd'hui" : it.deadline === dates[1] ? 'demain' : 'dans 3 jours'
      return `<li><strong>${esc(it.title)}</strong> (${it.kind}, ${esc(trip?.name ?? '')}) — à réserver <strong>${when}</strong> · <a href="${appUrl}#/t/${it.trip_id}/todo">ouvrir</a></li>`
    })
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: Deno.env.get('MAIL_FROM'),
        to: email,
        subject: `⏰ ${list.length} réservation${list.length > 1 ? 's' : ''} à faire bientôt`,
        html: `<p>Bonjour,</p><p>Petit rappel de Vadrouille :</p><ul>${rows.join('')}</ul><p>Bon voyage ! 🧭</p>`,
      }),
    })
    if (res.ok) sent++
  }
  return Response.json({ sent })
})
