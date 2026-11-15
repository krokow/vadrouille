// Supabase Edge Function (Deno) — notifications Web Push aux participants d'un voyage.
// Optionnelle. Appelée par un trigger Postgres (pg_net) à chaque nouvelle ligne de activity_log
// (voir supabase/cron/push-notify.sql).
//
// Secrets (JAMAIS dans le repo) :
//   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:toi@exemple.fr PUSH_SECRET=...
// Générer les clés VAPID : npx web-push generate-vapid-keys
import { createClient } from 'npm:@supabase/supabase-js@2.46.1'
import webpush from 'npm:web-push@3.6.7'

const ENTITY: Record<string, string> = {
  activities: 'l’activité', bookings: 'la réservation', expenses: 'la dépense', trip_members: 'le participant', settlements: 'un remboursement',
  comments: 'un commentaire', places: 'le lieu', checklist_items: 'un préparatif', journal_entries: 'une note du journal', options: 'l’option', budgets: 'le budget',
}
const VERB: Record<string, string> = { insert: 'a ajouté', update: 'a modifié', delete: 'a supprimé' }

Deno.serve(async (req) => {
  if (req.headers.get('authorization') !== `Bearer ${Deno.env.get('PUSH_SECRET')}`) return new Response('unauthorized', { status: 401 })
  const { record } = await req.json()
  if (!record?.trip_id) return Response.json({ sent: 0 })

  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')!, Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!)
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const [{ data: trip }, { data: members }] = await Promise.all([
    sb.from('trips').select('id, name').eq('id', record.trip_id).single(),
    sb.from('trip_members').select('user_id, display_name').eq('trip_id', record.trip_id).not('user_id', 'is', null),
  ])
  const actor = members?.find((m) => m.user_id === record.actor_id)?.display_name ?? 'Quelqu’un'
  const targets = (members ?? []).map((m) => m.user_id).filter((u) => u && u !== record.actor_id)
  if (!targets.length) return Response.json({ sent: 0 })
  const { data: subs } = await sb.from('push_subscriptions').select('id, endpoint, p256dh, auth').in('user_id', targets)

  const title = record.payload?.title ? ` « ${String(record.payload.title).slice(0, 60)} »` : ''
  const payload = JSON.stringify({
    title: trip?.name ?? 'Vadrouille',
    body: `${actor} ${VERB[record.action] ?? 'a modifié'} ${ENTITY[record.entity_type] ?? 'un élément'}${title}`,
    url: `#/t/${record.trip_id}/history`,
    tag: `trip-${record.trip_id}`,
  })
  let sent = 0
  await Promise.all((subs ?? []).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 6 })
      sent++
    } catch (e) {
      // abonnement expiré : on le supprime
      const code = (e as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) await sb.from('push_subscriptions').delete().eq('id', s.id)
    }
  }))
  return Response.json({ sent })
})
